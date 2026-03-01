import { matrixTokenManager } from "@/auth/token-manager";
import { MatrixApiError, matrixFetch, matrixUploadBlob } from "@/api/matrix-client";
import type { MatrixJoinedRoomsResponse } from "@/types";

const CANONICAL_MAPPING_EVENT_TYPE = "org.icclab.teams.mapping";
const CANONICAL_MAPPING_STATE_KEY = "canonical";

type CanonicalAppMetadata =
  | {
      kind: "team-space";
      teamId: string;
      teamName: string;
    }
  | {
      kind: "channel-room";
      teamId: string;
      channelId: string;
      source: "teams-channel" | "drive-folder";
    };

export async function createRoom(options: {
  name: string;
  topic?: string;
  preset?: "private_chat" | "public_chat" | "trusted_private_chat";
}): Promise<{ room_id: string }> {
  return matrixFetch<{ room_id: string }>("/v3/createRoom", {
    method: "POST",
    body: {
      name: options.name,
      topic: options.topic ?? "",
      preset: options.preset ?? "private_chat",
      initial_state: [
        {
          type: "m.room.history_visibility",
          content: { history_visibility: "shared" },
        },
      ],
    },
  });
}

export async function createSpace(options: {
  name: string;
  topic?: string;
}): Promise<{ room_id: string }> {
  return matrixFetch<{ room_id: string }>("/v3/createRoom", {
    method: "POST",
    body: {
      name: options.name,
      topic: options.topic ?? "",
      preset: "private_chat",
      creation_content: {
        type: "m.space",
      },
    },
  });
}

function makeTxnId(): string {
  return `m${Date.now()}.${Math.random().toString(36).slice(2)}`;
}

export class MatrixFileSendError extends Error {
  phase: "upload" | "send";
  cause: unknown;

  constructor(phase: "upload" | "send", cause: unknown) {
    const base = cause instanceof Error ? cause.message : "Unknown matrix file send error";
    super(`${phase} failed: ${base}`);
    this.name = "MatrixFileSendError";
    this.phase = phase;
    this.cause = cause;
  }
}

export async function sendMessage(
  roomId: string,
  body: string,
  formattedBody?: string,
): Promise<{ event_id: string }> {
  return matrixFetch<{ event_id: string }>(
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${makeTxnId()}`,
    {
      method: "PUT",
      body: {
        msgtype: "m.text",
        body,
        ...(formattedBody
          ? {
              format: "org.matrix.custom.html",
              formatted_body: formattedBody,
            }
          : {}),
      },
    },
  );
}

export async function sendNotice(
  roomId: string,
  body: string,
  formattedBody?: string,
): Promise<{ event_id: string }> {
  return matrixFetch<{ event_id: string }>(
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${makeTxnId()}`,
    {
      method: "PUT",
      body: {
        msgtype: "m.notice",
        body,
        ...(formattedBody
          ? {
              format: "org.matrix.custom.html",
              formatted_body: formattedBody,
            }
          : {}),
      },
    },
  );
}

export async function sendCloneNotice(roomId: string, body: string): Promise<{ event_id: string }> {
  return sendNotice(roomId, body);
}

export async function sendFile(
  roomId: string,
  file: Blob,
  options: {
    filename: string;
    mimeType?: string;
    size?: number;
    path?: string;
    channel?: string;
    driveItemId?: string;
  },
): Promise<{ event_id: string }> {
  let upload: { content_uri: string };
  try {
    upload = await matrixUploadBlob(file, options.filename, options.mimeType);
  } catch (error) {
    throw new MatrixFileSendError("upload", error);
  }

  const path = `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${makeTxnId()}`;
  const baseBody = {
    msgtype: "m.file",
    body: options.filename,
    filename: options.filename,
    url: upload.content_uri,
    info: {
      mimetype: options.mimeType || file.type || "application/octet-stream",
      size: options.size ?? file.size,
    },
  };
  const bodyWithMetadata = {
    ...baseBody,
    ...(options.path ? { "org.icclab.teams.path": options.path } : {}),
    ...(options.channel ? { "org.icclab.teams.channel": options.channel } : {}),
    ...(options.driveItemId ? { "org.icclab.teams.driveItemId": options.driveItemId } : {}),
  };

  try {
    return await matrixFetch<{ event_id: string }>(path, {
      method: "PUT",
      body: bodyWithMetadata,
    });
  } catch (error) {
    // Retry once with minimal Matrix m.file content if homeserver rejects custom metadata.
    if (error instanceof MatrixApiError && error.status >= 500) {
      try {
        return await matrixFetch<{ event_id: string }>(path, {
          method: "PUT",
          body: baseBody,
        });
      } catch (retryError) {
        throw new MatrixFileSendError("send", retryError);
      }
    }
    throw new MatrixFileSendError("send", error);
  }
}

export async function getJoinedRooms(): Promise<MatrixJoinedRoomsResponse> {
  return matrixFetch<MatrixJoinedRoomsResponse>("/_matrix/client/v3/joined_rooms");
}

export async function getRoomName(roomId: string): Promise<{ name: string }> {
  return matrixFetch<{ name: string }>(
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.name/`,
  );
}

export async function setWidgetInRoom(
  roomId: string,
  widgetId: string,
  widgetUrl: string,
  widgetName: string,
  creatorUserId: string,
): Promise<void> {
  await matrixFetch<void>(
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/im.vector.modular.widgets/${widgetId}`,
    {
      method: "PUT",
      body: {
        type: "customwidget",
        url: widgetUrl,
        name: widgetName,
        id: widgetId,
        creatorUserId,
      },
    },
  );
}

function getViaServerName(): string {
  try {
    const homeserver = matrixTokenManager.getHomeserver();
    const parsed = new URL(homeserver);
    return parsed.host;
  } catch {
    return "matrix.bsdu.eu";
  }
}

export async function addRoomToSpace(
  spaceId: string,
  roomId: string,
  via?: string[],
): Promise<void> {
  await matrixFetch<void>(
    `/_matrix/client/v3/rooms/${encodeURIComponent(spaceId)}/state/m.space.child/${encodeURIComponent(roomId)}`,
    {
      method: "PUT",
      body: {
        via: via && via.length > 0 ? via : [getViaServerName()],
      },
    },
  );
}

export async function setRoomParentSpace(
  roomId: string,
  spaceId: string,
  canonical = true,
  via?: string[],
): Promise<void> {
  await matrixFetch<void>(
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.space.parent/${encodeURIComponent(spaceId)}`,
    {
      method: "PUT",
      body: {
        canonical,
        via: via && via.length > 0 ? via : [getViaServerName()],
      },
    },
  );
}

export async function setCanonicalAppMetadata(
  roomId: string,
  metadata: CanonicalAppMetadata,
): Promise<void> {
  await matrixFetch<void>(
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/${encodeURIComponent(CANONICAL_MAPPING_EVENT_TYPE)}/${encodeURIComponent(CANONICAL_MAPPING_STATE_KEY)}`,
    {
      method: "PUT",
      body: metadata,
    },
  );
}

export async function getCanonicalAppMetadata(
  roomId: string,
): Promise<CanonicalAppMetadata | null> {
  try {
    return await matrixFetch<CanonicalAppMetadata>(
      `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/${encodeURIComponent(CANONICAL_MAPPING_EVENT_TYPE)}/${encodeURIComponent(CANONICAL_MAPPING_STATE_KEY)}`,
    );
  } catch (error) {
    if (error instanceof MatrixApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export { CANONICAL_MAPPING_EVENT_TYPE, CANONICAL_MAPPING_STATE_KEY };

export function getCurrentMatrixToken(): string | null {
  return matrixTokenManager.getToken();
}
