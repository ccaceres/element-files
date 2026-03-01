import { getFileContentBlob, listFolderTree, type DriveTreeFile } from "@/api/files";
import { TokenExpiredError } from "@/api/graph-client";
import { MatrixApiError } from "@/api/matrix-client";
import { MatrixFileSendError, sendCloneNotice, sendFile } from "@/api/matrix-rooms";
import { matrixTokenManager, tokenManager } from "@/auth/token-manager";
import { useSyncStore } from "@/stores/sync-store";
import type { FileCloneItemState, FileCloneMapping, FileCloneRunStats } from "@/types";

const SEND_DELAY_MS = 200;
const CLONE_CONCURRENCY = 2;
const FAILED_RETRY_DELAY_MS = 60 * 1000;

type TransferStage = "download" | "upload" | "send";

class CloneTransferError extends Error {
  stage: TransferStage;
  cause: unknown;

  constructor(stage: TransferStage, cause: unknown) {
    const baseMessage = cause instanceof Error ? cause.message : "Unknown clone transfer error";
    super(`${stage} failed: ${baseMessage}`);
    this.name = "CloneTransferError";
    this.stage = stage;
    this.cause = cause;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function toState(file: DriveTreeFile): FileCloneItemState {
  return {
    driveItemId: file.id,
    path: file.path,
    lastModifiedDateTime: file.lastModifiedDateTime,
    size: file.size,
  };
}

function isChanged(previous: FileCloneItemState, next: DriveTreeFile): boolean {
  return (
    previous.path !== next.path ||
    previous.size !== next.size ||
    previous.lastModifiedDateTime !== next.lastModifiedDateTime
  );
}

function shouldRetryFailedItem(previous: FileCloneItemState, nowMs: number): boolean {
  if (previous.lastCloneStatus !== "failed") {
    return false;
  }

  if (!previous.retryAfter) {
    return true;
  }

  const retryAt = Date.parse(previous.retryAfter);
  if (Number.isNaN(retryAt)) {
    return true;
  }

  return retryAt <= nowMs;
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) {
    return;
  }

  let cursor = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  const workers = Array.from({ length: workerCount }, () =>
    (async () => {
      while (cursor < items.length) {
        const item = items[cursor];
        cursor += 1;
        if (!item) {
          continue;
        }
        await task(item);
      }
    })(),
  );

  await Promise.all(workers);
}

class FileCloneEngine {
  private intervalId: ReturnType<typeof window.setInterval> | null = null;
  private running = false;
  private tickInFlight = false;

  isActive(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    void this.tick();

    const interval = useSyncStore.getState().fileClonePollIntervalSeconds * 1000;
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

  async runInitialClone(mapping: FileCloneMapping): Promise<FileCloneRunStats> {
    return this.processMapping(mapping, "initial");
  }

  async runDeltaTick(mapping: FileCloneMapping): Promise<FileCloneRunStats> {
    return this.processMapping(mapping, "delta");
  }

  private async tick(): Promise<void> {
    if (!this.running || this.tickInFlight) {
      return;
    }

    this.tickInFlight = true;

    try {
      const { fileCloneMappings } = useSyncStore.getState();
      const activeMappings = fileCloneMappings.filter(
        (mapping) => mapping.enabled && mapping.canonical && Boolean(mapping.matrixSpaceId),
      );

      for (const mapping of activeMappings) {
        try {
          const stats = await this.runDeltaTick(mapping);
          useSyncStore.getState().setFileCloneError(mapping.id, null);
          this.logSuccess(mapping, "delta", stats);
        } catch (error) {
          if (this.isFatalAuthError(error)) {
            this.handleFatalAuthError(error);
            return;
          }

          const message = error instanceof Error ? error.message : "File clone failed";
          useSyncStore.getState().setFileCloneError(mapping.id, message);
          useSyncStore.getState().addFileCloneLogEntry({
            mappingId: mapping.id,
            timestamp: new Date().toISOString(),
            channelName: `${mapping.teamName} > ${mapping.channelLabel}`,
            messageCount: 0,
            status: "error",
            action: "delta",
            error: message,
          });
        }
      }
    } finally {
      this.tickInFlight = false;
    }
  }

  private logSuccess(
    mapping: FileCloneMapping,
    action: "initial" | "delta",
    stats: FileCloneRunStats,
  ): void {
    const summary = `uploaded=${stats.uploaded}, updated=${stats.updated}, deleted=${stats.deleted}, errors=${stats.errors}`;
    useSyncStore.getState().addFileCloneLogEntry({
      mappingId: mapping.id,
      timestamp: new Date().toISOString(),
      channelName: `${mapping.teamName} > ${mapping.channelLabel}`,
      messageCount: stats.uploaded + stats.updated,
      status: stats.errors > 0 ? "error" : "success",
      action,
      error: stats.errors > 0 ? summary : undefined,
    });
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

    useSyncStore.getState().setFileCloneRunning(false);
    this.stop();
  }

  private async uploadFileWithMetadata(
    mapping: FileCloneMapping,
    file: DriveTreeFile,
  ): Promise<string | null> {
    let blob: Blob;
    try {
      blob = await getFileContentBlob(mapping.driveId, file.id);
    } catch (error) {
      throw new CloneTransferError("download", error);
    }

    try {
      const event = await sendFile(mapping.matrixRoomId, blob, {
        filename: file.name,
        mimeType: file.mimeType,
        size: file.size,
        path: file.path,
        channel: mapping.channelLabel,
        driveItemId: file.id,
      });
      await wait(SEND_DELAY_MS);
      return event.event_id;
    } catch (error) {
      if (error instanceof MatrixFileSendError) {
        throw new CloneTransferError(error.phase, error.cause);
      }
      throw new CloneTransferError("upload", error);
    }
  }

  private unwrapTransferError(error: unknown): {
    stage: TransferStage | "unknown";
    cause: unknown;
  } {
    if (error instanceof CloneTransferError) {
      return { stage: error.stage, cause: error.cause };
    }

    return { stage: "unknown", cause: error };
  }

  private toErrorMessage(stage: TransferStage | "unknown", error: unknown): string {
    const base = error instanceof Error ? error.message || "Unknown clone error" : "Unknown clone error";
    if (stage === "unknown") {
      return base;
    }
    return `${stage} failed: ${base}`;
  }

  private toFailedState(
    file: DriveTreeFile,
    previous: FileCloneItemState | undefined,
    message: string,
  ): FileCloneItemState {
    const now = new Date();
    return {
      ...toState(file),
      lastSentEventId: previous?.lastSentEventId ?? null,
      lastCloneStatus: "failed",
      lastError: message,
      lastAttemptedAt: now.toISOString(),
      retryAfter: new Date(now.getTime() + FAILED_RETRY_DELAY_MS).toISOString(),
    };
  }

  private async processMapping(
    mapping: FileCloneMapping,
    mode: "initial" | "delta",
  ): Promise<FileCloneRunStats> {
    const stats: FileCloneRunStats = {
      scanned: 0,
      uploaded: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
      errors: 0,
    };

    const activeMapping = useSyncStore
      .getState()
      .fileCloneMappings.find((entry) => entry.id === mapping.id);
    if (!activeMapping?.enabled || !activeMapping.canonical || !activeMapping.matrixSpaceId) {
      return stats;
    }

    const tree = await listFolderTree(mapping.driveId, mapping.rootFolderId);
    stats.scanned = tree.length;

    const previousIndex = useSyncStore.getState().fileCloneStateIndex[mapping.id] ?? {};
    const nextIndex: Record<string, FileCloneItemState> = { ...previousIndex };
    const nowMs = Date.now();

    const currentById = new Map<string, DriveTreeFile>();
    for (const file of tree) {
      currentById.set(file.id, file);
    }

    const toUpload: DriveTreeFile[] = [];
    const toUpdate: DriveTreeFile[] = [];

    for (const file of tree) {
      const previous = previousIndex[file.id];
      if (!previous) {
        toUpload.push(file);
        continue;
      }

      if (isChanged(previous, file)) {
        toUpdate.push(file);
      } else {
        const shouldRetry =
          mode === "initial" || (mode === "delta" && shouldRetryFailedItem(previous, nowMs));

        if (!shouldRetry) {
          stats.skipped += 1;
          continue;
        }

        if (previous.lastSentEventId) {
          toUpdate.push(file);
        } else {
          toUpload.push(file);
        }
      }
    }

    const deletedIds = Object.keys(previousIndex).filter((id) => !currentById.has(id));

    if (mode === "initial") {
      await sendCloneNotice(
        mapping.matrixRoomId,
        `📁 Starting initial file clone for ${mapping.teamName} > ${mapping.channelLabel} (${tree.length} files).`,
      );
    }

    const uploadWork = async (
      file: DriveTreeFile,
      kind: "upload" | "update",
    ): Promise<void> => {
      const stillEnabled = useSyncStore
        .getState()
        .fileCloneMappings.find((entry) => entry.id === mapping.id)?.enabled;
      if (!stillEnabled) {
        stats.skipped += 1;
        return;
      }

      try {
        if (kind === "update") {
          await sendCloneNotice(
            mapping.matrixRoomId,
            `♻️ Updated in Teams: ${file.path}. Uploading latest version.`,
          );
        }

        const eventId = await this.uploadFileWithMetadata(mapping, file);
        nextIndex[file.id] = {
          ...toState(file),
          lastSentEventId: eventId,
          lastError: null,
          lastAttemptedAt: new Date().toISOString(),
          retryAfter: null,
        };

        if (kind === "upload") {
          stats.uploaded += 1;
        } else {
          stats.updated += 1;
        }
      } catch (error) {
        const { stage, cause } = this.unwrapTransferError(error);

        if (cause instanceof MatrixApiError && cause.status === 413) {
          stats.skipped += 1;
          nextIndex[file.id] = this.toFailedState(
            file,
            previousIndex[file.id],
            "upload failed: payload too large (413).",
          );
          useSyncStore.getState().addFileCloneLogEntry({
            mappingId: mapping.id,
            timestamp: new Date().toISOString(),
            channelName: `${mapping.teamName} > ${mapping.channelLabel}`,
            messageCount: 0,
            status: "error",
            action: kind,
            path: file.path,
            error: "Skipped file upload: payload too large (413).",
          });
          return;
        }

        stats.errors += 1;
        const message = this.toErrorMessage(stage, cause);
        nextIndex[file.id] = this.toFailedState(file, previousIndex[file.id], message);
        useSyncStore.getState().addFileCloneLogEntry({
          mappingId: mapping.id,
          timestamp: new Date().toISOString(),
          channelName: `${mapping.teamName} > ${mapping.channelLabel}`,
          messageCount: 0,
          status: "error",
          action: kind,
          path: file.path,
          error: message,
        });
        if (this.isFatalAuthError(cause)) {
          throw cause;
        }
      }
    };

    await runWithConcurrency(toUpload, CLONE_CONCURRENCY, async (file) => uploadWork(file, "upload"));
    await runWithConcurrency(toUpdate, CLONE_CONCURRENCY, async (file) => uploadWork(file, "update"));

    for (const driveItemId of deletedIds) {
      const stillEnabled = useSyncStore
        .getState()
        .fileCloneMappings.find((entry) => entry.id === mapping.id)?.enabled;
      if (!stillEnabled) {
        stats.skipped += 1;
        continue;
      }

      const deletedState = previousIndex[driveItemId];
      if (!deletedState) {
        continue;
      }

      try {
        await sendCloneNotice(
          mapping.matrixRoomId,
          `🗑️ Deleted in Teams: ${deletedState.path}. Source removed; Element copy kept.`,
        );
        delete nextIndex[driveItemId];
        stats.deleted += 1;
      } catch (error) {
        stats.errors += 1;
        if (this.isFatalAuthError(error)) {
          throw error;
        }
      }
    }

    useSyncStore.getState().setFileCloneMappingState(mapping.id, nextIndex);
    useSyncStore.getState().updateFileCloneMapping(mapping.id, {
      lastClonedAt: new Date().toISOString(),
    });

    if (mode === "initial") {
      await sendCloneNotice(
        mapping.matrixRoomId,
        `✅ Initial file clone finished for ${mapping.teamName} > ${mapping.channelLabel}. Uploaded ${stats.uploaded} files.`,
      );
    }

    return stats;
  }
}

export const fileCloneEngine = new FileCloneEngine();

export { CLONE_CONCURRENCY };
