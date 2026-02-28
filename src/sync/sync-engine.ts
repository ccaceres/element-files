import { TokenExpiredError } from "@/api/graph-client";
import { MatrixApiError } from "@/api/matrix-client";
import { getChannelMessages } from "@/api/messages";
import { sendMessage } from "@/api/matrix-rooms";
import { matrixTokenManager, tokenManager } from "@/auth/token-manager";
import { useSyncStore } from "@/stores/sync-store";
import type { ChannelMapping, TeamsMessage } from "@/types";

const MAX_RECENT_IDS = 200;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

class SyncEngine {
  private intervalId: ReturnType<typeof window.setInterval> | null = null;
  private running = false;
  private tickInFlight = false;
  private recentlySynced = new Map<string, Set<string>>();

  isActive(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    void this.tick();

    const interval = useSyncStore.getState().pollIntervalSeconds * 1000;
    this.intervalId = window.setInterval(() => {
      void this.tick();
    }, interval);
  }

  stop(): void {
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.running = false;
  }

  restart(): void {
    this.stop();
    this.start();
  }

  private async tick(): Promise<void> {
    if (!this.running || this.tickInFlight) {
      return;
    }

    this.tickInFlight = true;

    try {
      const { mappings } = useSyncStore.getState();
      const activeMappings = mappings.filter((mapping) => mapping.enabled);

      for (const mapping of activeMappings) {
        try {
          const messages = await this.fetchNewMessages(mapping);
          if (messages.length > 0) {
            await this.postToMatrix(mapping, messages);

            const newest = messages[messages.length - 1];
            useSyncStore.getState().updateMapping(mapping.channelId, {
              lastSyncedMessageId: newest?.id ?? null,
              lastSyncedAt: newest?.createdDateTime ?? null,
            });
          }

          useSyncStore.getState().setSyncError(mapping.channelId, null);
          useSyncStore.getState().addLogEntry({
            timestamp: new Date().toISOString(),
            channelName: `${mapping.teamName} > ${mapping.channelName}`,
            messageCount: messages.length,
            status: "success",
          });
        } catch (error) {
          if (this.isFatalAuthError(error)) {
            this.handleFatalAuthError(error);
            return;
          }

          const message = error instanceof Error ? error.message : "Unknown sync error";
          useSyncStore.getState().setSyncError(mapping.channelId, message);
          useSyncStore.getState().addLogEntry({
            timestamp: new Date().toISOString(),
            channelName: `${mapping.teamName} > ${mapping.channelName}`,
            messageCount: 0,
            status: "error",
            error: message,
          });
        }
      }
    } finally {
      this.tickInFlight = false;
    }
  }

  private isFatalAuthError(error: unknown): boolean {
    if (error instanceof TokenExpiredError) {
      return true;
    }

    if (error instanceof MatrixApiError && error.status === 401) {
      return true;
    }

    return false;
  }

  private handleFatalAuthError(error: unknown): void {
    if (error instanceof TokenExpiredError) {
      tokenManager.clearToken("expired");
    }

    if (error instanceof MatrixApiError && error.status === 401) {
      matrixTokenManager.clearToken();
    }

    useSyncStore.getState().setSyncRunning(false);
    this.stop();
  }

  private async fetchNewMessages(mapping: ChannelMapping): Promise<TeamsMessage[]> {
    const response = await getChannelMessages(mapping.teamId, mapping.channelId, 20);

    let messages = response.value.filter((message) => message.messageType === "message");

    if (mapping.lastSyncedAt) {
      const lastSyncedTime = new Date(mapping.lastSyncedAt).getTime();
      messages = messages.filter(
        (message) => new Date(message.createdDateTime).getTime() > lastSyncedTime,
      );
    }

    messages = messages.filter((message) => !this.isAlreadySynced(mapping.channelId, message.id));

    messages.sort((a, b) =>
      new Date(a.createdDateTime).getTime() - new Date(b.createdDateTime).getTime(),
    );

    return messages;
  }

  private async postToMatrix(mapping: ChannelMapping, messages: TeamsMessage[]): Promise<void> {
    for (const message of messages) {
      const sender =
        message.from?.user?.displayName ?? message.from?.application?.displayName ?? "Unknown";

      const plainBody = this.formatMessagePlain(sender, message);
      const htmlBody = this.formatMessageHtml(sender, message);

      await this.sendMessageWithBackoff(mapping.matrixRoomId, plainBody, htmlBody);
      this.markSynced(mapping.channelId, message.id);

      await wait(200);
    }
  }

  private async sendMessageWithBackoff(
    roomId: string,
    plainBody: string,
    htmlBody: string,
  ): Promise<void> {
    let attempt = 0;

    while (attempt < 6) {
      try {
        await sendMessage(roomId, plainBody, htmlBody);
        return;
      } catch (error) {
        if (!(error instanceof MatrixApiError) || error.status !== 429) {
          throw error;
        }

        const retryDelay =
          error.retryAfterMs && error.retryAfterMs > 0
            ? error.retryAfterMs
            : Math.min(1000 * 2 ** attempt, 30_000);

        await wait(retryDelay);
        attempt += 1;
      }
    }

    throw new MatrixApiError(429, "Matrix rate limit exceeded after retries");
  }

  formatMessageHtml(sender: string, message: TeamsMessage): string {
    const timestamp = new Date(message.createdDateTime).toLocaleTimeString();
    const content =
      message.body.contentType === "html"
        ? message.body.content
        : this.escapeHtml(message.body.content);

    let attachmentsHtml = "";
    if (message.attachments?.length) {
      attachmentsHtml = message.attachments
        .map((attachment) => {
          if (attachment.contentUrl) {
            return `<br/>📎 <a href="${this.escapeHtml(attachment.contentUrl)}">${this.escapeHtml(
              attachment.name ?? "attachment",
            )}</a>`;
          }

          return `<br/>📎 ${this.escapeHtml(attachment.name ?? "attachment")}`;
        })
        .join("");
    }

    return `<strong>💬 ${this.escapeHtml(sender)}</strong> <em>(${timestamp} via Teams)</em><br/>${content}${attachmentsHtml}`;
  }

  formatMessagePlain(sender: string, message: TeamsMessage): string {
    const timestamp = new Date(message.createdDateTime).toLocaleTimeString();
    const content =
      message.body.contentType === "html"
        ? this.stripHtml(message.body.content)
        : message.body.content;

    let attachmentsText = "";
    if (message.attachments?.length) {
      attachmentsText =
        "\n" +
        message.attachments
          .map(
            (attachment) =>
              `📎 ${attachment.name ?? "attachment"}${attachment.contentUrl ? `: ${attachment.contentUrl}` : ""}`,
          )
          .join("\n");
    }

    return `💬 ${sender} (${timestamp} via Teams)\n${content}${attachmentsText}`;
  }

  private isAlreadySynced(channelId: string, messageId: string): boolean {
    return this.recentlySynced.get(channelId)?.has(messageId) ?? false;
  }

  private markSynced(channelId: string, messageId: string): void {
    if (!this.recentlySynced.has(channelId)) {
      this.recentlySynced.set(channelId, new Set());
    }

    const set = this.recentlySynced.get(channelId);
    if (!set) {
      return;
    }

    set.add(messageId);
    if (set.size > MAX_RECENT_IDS) {
      const oldest = set.values().next().value as string | undefined;
      if (oldest) {
        set.delete(oldest);
      }
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "").trim();
  }
}

export const syncEngine = new SyncEngine();
