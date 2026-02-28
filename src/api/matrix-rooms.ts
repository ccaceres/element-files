import { matrixTokenManager } from "@/auth/token-manager";
import { matrixFetch } from "@/api/matrix-client";
import type { MatrixJoinedRoomsResponse } from "@/types";

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

function makeTxnId(): string {
  return `m${Date.now()}.${Math.random().toString(36).slice(2)}`;
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

export function getCurrentMatrixToken(): string | null {
  return matrixTokenManager.getToken();
}
