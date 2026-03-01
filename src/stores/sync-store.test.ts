import { beforeEach, describe, expect, it } from "vitest";
import { useSyncStore } from "@/stores/sync-store";
import type { ChannelMapping, FileCloneMapping } from "@/types";

describe("sync store", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    useSyncStore.setState((state) => ({
      ...state,
      mappings: [],
      syncLog: [],
      syncErrors: {},
      syncRunning: false,
      pollIntervalSeconds: 30,
      autoPinWidget: true,
      activeTab: "files",
      fileCloneMappings: [],
      fileCloneLog: [],
      fileCloneErrors: {},
      fileCloneRunning: false,
      fileClonePollIntervalSeconds: 30,
      fileCloneStateIndex: {},
      teamSpaceMappings: [],
      syncSchemaVersion: 2,
    }));
  });

  it("persists message mappings to sessionStorage", () => {
    const mapping: ChannelMapping = {
      id: "team-1:channel-1",
      teamId: "team-1",
      teamName: "Team One",
      channelId: "channel-1",
      channelName: "General",
      channelLabel: "General",
      source: "teams-channel",
      driveId: null,
      rootFolderId: null,
      matrixRoomId: "!room:matrix.bsdu.eu",
      lastSyncedMessageId: null,
      lastSyncedAt: null,
      enabled: true,
    };

    useSyncStore.getState().addMapping(mapping);

    const persisted = window.sessionStorage.getItem("sync_channel_mappings");
    expect(persisted).toContain("channel-1");
  });

  it("caps message sync log entries at 100", () => {
    for (let index = 0; index < 120; index += 1) {
      useSyncStore.getState().addLogEntry({
        timestamp: new Date(index * 1000).toISOString(),
        channelName: `channel-${index}`,
        messageCount: index,
        status: "success",
      });
    }

    const entries = useSyncStore.getState().syncLog;
    expect(entries).toHaveLength(100);
    expect(entries[0]?.channelName).toBe("channel-119");
    expect(entries[99]?.channelName).toBe("channel-20");
  });

  it("persists file clone mappings and state index", () => {
    const mapping: FileCloneMapping = {
      id: "team-1:channel-1",
      teamId: "team-1",
      teamName: "Team One",
      channelId: "channel-1",
      channelLabel: "General",
      source: "drive-folder",
      driveId: "drive-1",
      rootFolderId: "root-1",
      matrixSpaceId: "!space:matrix.bsdu.eu",
      matrixRoomId: "!room:matrix.bsdu.eu",
      canonical: true,
      enabled: true,
      lastClonedAt: null,
    };

    useSyncStore.getState().addFileCloneMapping(mapping);
    useSyncStore.getState().upsertFileCloneItemState(mapping.id, {
      driveItemId: "item-1",
      path: "/General/spec.docx",
      lastModifiedDateTime: "2026-02-28T11:00:00Z",
      size: 123,
    });
    useSyncStore.getState().setFileCloneCooldown(mapping.id, "2026-03-01T12:00:00.000Z");

    const storedMappings = window.sessionStorage.getItem("file_clone_mappings");
    const storedIndex = window.sessionStorage.getItem("file_clone_state_index");
    const storedCooldown = window.sessionStorage.getItem("file_clone_cooldown_until");
    expect(storedMappings).toContain("drive-1");
    expect(storedIndex).toContain("item-1");
    expect(storedCooldown).toContain("2026-03-01T12:00:00.000Z");
  });
});
