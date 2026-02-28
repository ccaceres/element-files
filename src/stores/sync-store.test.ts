import { beforeEach, describe, expect, it } from "vitest";
import { useSyncStore } from "@/stores/sync-store";
import type { ChannelMapping } from "@/types";

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
    }));
  });

  it("persists mappings to sessionStorage", () => {
    const mapping: ChannelMapping = {
      teamId: "team-1",
      teamName: "Team One",
      channelId: "channel-1",
      channelName: "General",
      matrixRoomId: "!room:matrix.bsdu.eu",
      lastSyncedMessageId: null,
      lastSyncedAt: null,
      enabled: true,
    };

    useSyncStore.getState().addMapping(mapping);

    const persisted = window.sessionStorage.getItem("sync_channel_mappings");
    expect(persisted).toContain("channel-1");
  });

  it("caps sync log entries at 100", () => {
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
});
