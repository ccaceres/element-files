import { beforeEach, describe, expect, it, vi } from "vitest";
import { MatrixApiError } from "@/api/matrix-client";
import { setupFileCloneRooms } from "@/sync/room-setup";
import type { CloneRoot } from "@/types";

const getJoinedRoomsMock = vi.fn();
const getCanonicalAppMetadataMock = vi.fn();
const createSpaceMock = vi.fn();
const createRoomMock = vi.fn();
const setCanonicalAppMetadataMock = vi.fn();
const addRoomToSpaceMock = vi.fn();
const setRoomParentSpaceMock = vi.fn();
const setWidgetInRoomMock = vi.fn();

vi.mock("@/api/messages", () => ({
  getChannelMessages: vi.fn(),
}));

vi.mock("@/sync/sync-engine", () => ({
  syncEngine: {
    formatMessagePlain: vi.fn(),
    formatMessageHtml: vi.fn(),
  },
}));

vi.mock("@/api/matrix-rooms", () => ({
  getJoinedRooms: (...args: unknown[]) => getJoinedRoomsMock(...args),
  getCanonicalAppMetadata: (...args: unknown[]) => getCanonicalAppMetadataMock(...args),
  createSpace: (...args: unknown[]) => createSpaceMock(...args),
  createRoom: (...args: unknown[]) => createRoomMock(...args),
  setCanonicalAppMetadata: (...args: unknown[]) => setCanonicalAppMetadataMock(...args),
  addRoomToSpace: (...args: unknown[]) => addRoomToSpaceMock(...args),
  setRoomParentSpace: (...args: unknown[]) => setRoomParentSpaceMock(...args),
  setWidgetInRoom: (...args: unknown[]) => setWidgetInRoomMock(...args),
  sendMessage: vi.fn(),
  sendNotice: vi.fn(),
}));

describe("setupFileCloneRooms", () => {
  const roots: CloneRoot[] = [
    {
      teamId: "team-1",
      channelId: "channel-1",
      channelLabel: "General",
      source: "drive-folder",
      driveId: "drive-1",
      rootFolderId: "folder-1",
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    getJoinedRoomsMock.mockReset();
    getCanonicalAppMetadataMock.mockReset();
    createSpaceMock.mockReset();
    createRoomMock.mockReset();
    setCanonicalAppMetadataMock.mockReset();
    addRoomToSpaceMock.mockReset();
    setRoomParentSpaceMock.mockReset();
    setWidgetInRoomMock.mockReset();

    getJoinedRoomsMock.mockResolvedValue({
      joined_rooms: ["!a:matrix", "!b:matrix", "!c:matrix", "!d:matrix"],
    });
    getCanonicalAppMetadataMock.mockResolvedValue(null);
    createSpaceMock.mockResolvedValue({ room_id: "!space-created:matrix" });
    createRoomMock.mockResolvedValue({ room_id: "!room-created:matrix" });
    setCanonicalAppMetadataMock.mockResolvedValue(undefined);
    addRoomToSpaceMock.mockResolvedValue(undefined);
    setRoomParentSpaceMock.mockResolvedValue(undefined);
    setWidgetInRoomMock.mockResolvedValue(undefined);
  });

  it("stops metadata scan early once required canonical room and space are found", async () => {
    getCanonicalAppMetadataMock.mockImplementation(async (roomId: string) => {
      if (roomId === "!a:matrix") {
        return {
          kind: "team-space",
          teamId: "team-1",
          teamName: "Team One",
        };
      }
      if (roomId === "!b:matrix") {
        return {
          kind: "channel-room",
          teamId: "team-1",
          channelId: "channel-1",
          source: "drive-folder",
        };
      }
      return null;
    });

    const result = await setupFileCloneRooms("team-1", "Team One", roots, [], [], {
      pinWidget: false,
      widgetUrl: "http://localhost:5174",
    });

    expect(getCanonicalAppMetadataMock).toHaveBeenCalledTimes(2);
    expect(createSpaceMock).not.toHaveBeenCalled();
    expect(createRoomMock).not.toHaveBeenCalled();
    expect(result.teamSpaceMapping.matrixSpaceId).toBe("!a:matrix");
    expect(result.mappings[0]?.matrixRoomId).toBe("!b:matrix");
  });

  it("retries room setup API calls when matrix returns 429", async () => {
    getJoinedRoomsMock
      .mockRejectedValueOnce(new MatrixApiError(429, "Too Many Requests", 1))
      .mockResolvedValueOnce({ joined_rooms: [] });

    await setupFileCloneRooms("team-1", "Team One", roots, [], [], {
      pinWidget: false,
      widgetUrl: "http://localhost:5174",
    });

    expect(getJoinedRoomsMock).toHaveBeenCalledTimes(2);
  });
});
