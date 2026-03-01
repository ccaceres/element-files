import { getChannelMessages } from "@/api/messages";
import { MatrixApiError } from "@/api/matrix-client";
import {
  addRoomToSpace,
  createRoom,
  createSpace,
  getCanonicalAppMetadata,
  getJoinedRooms,
  sendMessage,
  sendNotice,
  setCanonicalAppMetadata,
  setRoomParentSpace,
  setWidgetInRoom,
} from "@/api/matrix-rooms";
import { syncEngine } from "@/sync/sync-engine";
import { computeBackoffWithJitter, sleep } from "@/utils/retry";
import type {
  Channel,
  ChannelMapping,
  CloneRoot,
  FileCloneMapping,
  TeamSpaceMapping,
} from "@/types";

const SETUP_MAX_RETRIES = 5;

function toRateLimitDelayMs(error: MatrixApiError, attempt: number): number {
  if (error.retryAfterMs && error.retryAfterMs > 0) {
    return Math.min(60_000, error.retryAfterMs);
  }

  return computeBackoffWithJitter(attempt, 1000, 60_000);
}

async function withMatrixRateLimitRetry<T>(
  operation: () => Promise<T>,
  context: string,
): Promise<T> {
  let attempt = 0;

  while (attempt <= SETUP_MAX_RETRIES) {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof MatrixApiError) || error.status !== 429) {
        throw error;
      }

      if (attempt === SETUP_MAX_RETRIES) {
        throw new MatrixApiError(
          429,
          `Rate limited during ${context}. Please retry in a moment.`,
          error.retryAfterMs,
        );
      }

      const delay = toRateLimitDelayMs(error, attempt);
      await sleep(delay);
      attempt += 1;
    }
  }

  throw new MatrixApiError(429, `Rate limited during ${context}. Please retry in a moment.`);
}

export async function backfillMessages(
  mapping: ChannelMapping,
  count = 50,
): Promise<number> {
  const response = await getChannelMessages(mapping.teamId, mapping.channelId, count);

  const messages = response.value
    .filter((message) => message.messageType === "message")
    .sort(
      (a, b) =>
        new Date(a.createdDateTime).getTime() - new Date(b.createdDateTime).getTime(),
    );

  await sendNotice(
    mapping.matrixRoomId,
    `📋 Importing ${messages.length} messages from Teams channel "${mapping.channelName}"...`,
  );

  for (const message of messages) {
    const sender =
      message.from?.user?.displayName ?? message.from?.application?.displayName ?? "Unknown";

    await sendMessage(
      mapping.matrixRoomId,
      syncEngine.formatMessagePlain(sender, message),
      syncEngine.formatMessageHtml(sender, message),
    );

    await sleep(150);
  }

  await sendNotice(
    mapping.matrixRoomId,
    `✅ Imported ${messages.length} messages from Teams. Live sync is ${mapping.enabled ? "active" : "paused"}.`,
  );

  return messages.length;
}

export async function setupTeamRooms(
  teamId: string,
  teamName: string,
  channels: Channel[],
  options: {
    pinWidget: boolean;
    widgetUrl: string;
    widgetName?: string;
    matrixUserId: string;
    backfillCount: number;
  },
): Promise<ChannelMapping[]> {
  const mappings: ChannelMapping[] = [];

  for (const channel of channels) {
    if (channel.source !== "teams-channel") {
      continue;
    }

    const roomName = `${teamName} - ${channel.displayName}`;
    const created = await withMatrixRateLimitRetry(
      () =>
        createRoom({
          name: roomName,
          topic: `Bridged from Teams: ${teamName} > ${channel.displayName}`,
          preset: "private_chat",
        }),
      "create room",
    );

    if (options.pinWidget) {
      await withMatrixRateLimitRetry(
        () =>
          setWidgetInRoom(
            created.room_id,
            `files-widget-${channel.id}`,
            options.widgetUrl,
            options.widgetName ?? "ICC-LAB Files",
            options.matrixUserId,
          ),
        "pin widget",
      );
    }

    const mapping: ChannelMapping = {
      id: `${teamId}:${channel.id}`,
      teamId,
      teamName,
      channelId: channel.id,
      channelName: channel.displayName,
      channelLabel: channel.displayName,
      source: "teams-channel",
      driveId: null,
      rootFolderId: null,
      matrixRoomId: created.room_id,
      lastSyncedMessageId: null,
      lastSyncedAt: null,
      enabled: true,
    };

    mappings.push(mapping);

    if (options.backfillCount > 0) {
      await backfillMessages(mapping, options.backfillCount);
    }

    await sleep(500);
  }

  return mappings;
}

export async function setupFileCloneRooms(
  teamId: string,
  teamName: string,
  roots: CloneRoot[],
  existingMappings: FileCloneMapping[],
  existingTeamSpaceMappings: TeamSpaceMapping[],
  options: {
    pinWidget: boolean;
    widgetUrl: string;
    widgetName?: string;
    matrixUserId?: string;
  }): Promise<{
    teamSpaceMapping: TeamSpaceMapping;
    mappings: FileCloneMapping[];
  }> {
  function normalizeChannelName(value: string): string {
    return value.trim().toLowerCase();
  }

  function mappingKey(root: CloneRoot): string {
    return `${teamId}:${root.channelId}`;
  }

  const uniqueRoots = new Map<string, CloneRoot>();
  for (const root of roots) {
    const key = mappingKey(root);
    if (!uniqueRoots.has(key)) {
      uniqueRoots.set(key, root);
    }
  }

  const joinedRooms = await withMatrixRateLimitRetry(
    () => getJoinedRooms(),
    "list joined rooms",
  ).catch(() => ({ joined_rooms: [] }));
  const canonicalTeamSpaces = new Map<string, string>();
  const canonicalChannelRooms = new Map<string, string>();
  const unresolvedChannelKeys = new Set([...uniqueRoots.keys()]);

  for (const roomId of joinedRooms.joined_rooms) {
    if (canonicalTeamSpaces.has(teamId) && unresolvedChannelKeys.size === 0) {
      break;
    }

    try {
      const metadata = await withMatrixRateLimitRetry(
        () => getCanonicalAppMetadata(roomId),
        "read canonical metadata",
      );
      if (!metadata) {
        continue;
      }

      if (metadata.kind === "team-space") {
        canonicalTeamSpaces.set(metadata.teamId, roomId);
        continue;
      }

      const key = `${metadata.teamId}:${metadata.channelId}`;
      canonicalChannelRooms.set(key, roomId);
      unresolvedChannelKeys.delete(key);
    } catch {
      // Ignore unreadable metadata.
    }
  }

  async function resolveOrCreateTeamSpace(): Promise<TeamSpaceMapping> {
    const existing = existingTeamSpaceMappings.find((entry) => entry.teamId === teamId);
    if (existing?.matrixSpaceId) {
      try {
        const metadata = await withMatrixRateLimitRetry(
          () => getCanonicalAppMetadata(existing.matrixSpaceId),
          "validate existing team space metadata",
        );
        if (metadata?.kind === "team-space" && metadata.teamId === teamId) {
          return existing;
        }
      } catch {
        // Continue to strict metadata scan fallback.
      }
    }

    const discoveredSpaceId = canonicalTeamSpaces.get(teamId);
    if (discoveredSpaceId) {
      return {
        teamId,
        teamName,
        matrixSpaceId: discoveredSpaceId,
        canonical: true,
        createdAt: new Date().toISOString(),
      };
    }

    const created = await withMatrixRateLimitRetry(
      () =>
        createSpace({
          name: teamName,
          topic: `Teams space mirror for ${teamName}`,
        }),
      "create team space",
    );

    await withMatrixRateLimitRetry(
      () =>
        setCanonicalAppMetadata(created.room_id, {
          kind: "team-space",
          teamId,
          teamName,
        }),
      "write team space metadata",
    );

    return {
      teamId,
      teamName,
      matrixSpaceId: created.room_id,
      canonical: true,
      createdAt: new Date().toISOString(),
    };
  }

  async function resolveOrCreateChannelRoom(
    root: CloneRoot,
    spaceId: string,
  ): Promise<FileCloneMapping> {
    const id = mappingKey(root);
    const existing = existingMappings.find((entry) => entry.id === id);
    const roomName = `${teamName} - ${root.channelLabel}`;
    const channelNameNormalized = normalizeChannelName(root.channelLabel);
    let roomId: string | null = null;

    if (existing?.matrixRoomId && existing.canonical) {
      try {
        const metadata = await withMatrixRateLimitRetry(
          () => getCanonicalAppMetadata(existing.matrixRoomId),
          "validate existing channel room metadata",
        );
        if (
          metadata?.kind === "channel-room" &&
          metadata.teamId === teamId &&
          metadata.channelId === root.channelId
        ) {
          roomId = existing.matrixRoomId;
        }
      } catch {
        // Continue fallback discovery.
      }
    }

    if (!roomId) {
      roomId = canonicalChannelRooms.get(id) ?? null;
    }

    if (!roomId) {
      const created = await withMatrixRateLimitRetry(
        () =>
          createRoom({
            name: roomName,
            topic: `Cloned from Teams files: ${teamName} > ${root.channelLabel}`,
            preset: "private_chat",
          }),
        "create channel room",
      );
      roomId = created.room_id;
    }

    await withMatrixRateLimitRetry(
      () =>
        setCanonicalAppMetadata(roomId, {
          kind: "channel-room",
          teamId,
          channelId: root.channelId,
          source: root.source,
        }),
      "write channel room metadata",
    );
    await withMatrixRateLimitRetry(() => addRoomToSpace(spaceId, roomId), "link room into space");
    await withMatrixRateLimitRetry(
      () => setRoomParentSpace(roomId, spaceId, true),
      "set room parent space",
    );

    if (options.pinWidget && options.matrixUserId) {
      await withMatrixRateLimitRetry(
        () =>
          setWidgetInRoom(
            roomId,
            `files-widget-${root.channelId}`,
            options.widgetUrl,
            options.widgetName ?? "ICC-LAB Files",
            options.matrixUserId,
          ),
        "pin room widget",
      );
    }

    return {
      id,
      teamId,
      teamName,
      channelId: root.channelId,
      channelLabel: root.channelLabel,
      channelNameNormalized,
      source: root.source,
      driveId: root.driveId,
      rootFolderId: root.rootFolderId,
      matrixSpaceId: spaceId,
      matrixRoomId: roomId,
      canonical: true,
      health: "ok",
      enabled: existing?.enabled ?? true,
      lastClonedAt: existing?.lastClonedAt ?? null,
    };
  }

  const teamSpaceMapping = await resolveOrCreateTeamSpace();

  const mappings: FileCloneMapping[] = [];
  for (const root of uniqueRoots.values()) {
    const mapping = await resolveOrCreateChannelRoom(root, teamSpaceMapping.matrixSpaceId);
    mappings.push(mapping);
    await sleep(500);
  }

  return { teamSpaceMapping, mappings };
}
