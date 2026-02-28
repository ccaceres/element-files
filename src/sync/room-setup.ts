import { getChannelMessages } from "@/api/messages";
import { createRoom, sendMessage, sendNotice, setWidgetInRoom } from "@/api/matrix-rooms";
import { syncEngine } from "@/sync/sync-engine";
import type { Channel, ChannelMapping } from "@/types";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
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

    await wait(150);
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
    const created = await createRoom({
      name: roomName,
      topic: `Bridged from Teams: ${teamName} > ${channel.displayName}`,
      preset: "private_chat",
    });

    if (options.pinWidget) {
      await setWidgetInRoom(
        created.room_id,
        `files-widget-${channel.id}`,
        options.widgetUrl,
        options.widgetName ?? "ICC-LAB Files",
        options.matrixUserId,
      );
    }

    const mapping: ChannelMapping = {
      teamId,
      teamName,
      channelId: channel.id,
      channelName: channel.displayName,
      matrixRoomId: created.room_id,
      lastSyncedMessageId: null,
      lastSyncedAt: null,
      enabled: true,
    };

    mappings.push(mapping);

    if (options.backfillCount > 0) {
      await backfillMessages(mapping, options.backfillCount);
    }

    await wait(500);
  }

  return mappings;
}
