import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCloneRoots } from "@/api/teams";

const { graphFetchMock, GraphApiErrorMock } = vi.hoisted(() => {
  const graphFetchMock = vi.fn();

  class GraphApiErrorMock extends Error {
    status: number;

    constructor(status: number, statusText: string, message: string) {
      super(message || `Graph API error: ${status} ${statusText}`);
      this.name = "GraphApiError";
      this.status = status;
    }
  }

  return { graphFetchMock, GraphApiErrorMock };
});

vi.mock("@/api/graph-client", () => ({
  GRAPH_BASE: "https://graph.microsoft.com/v1.0",
  graphFetch: (...args: unknown[]) => graphFetchMock(...args),
  graphFetchBlob: vi.fn(),
  GraphApiError: GraphApiErrorMock,
}));

describe("resolveCloneRoots", () => {
  beforeEach(() => {
    graphFetchMock.mockReset();
  });

  it("resolves roots from real teams channels", async () => {
    graphFetchMock.mockImplementation((path: string) => {
      if (path === "/teams/team-1/channels") {
        return Promise.resolve({
          value: [
            { id: "channel-1", displayName: "General" },
            { id: "channel-2", displayName: "Docs" },
          ],
        });
      }

      if (path === "/teams/team-1/channels/channel-1/filesFolder") {
        return Promise.resolve({
          id: "folder-1",
          name: "General",
          parentReference: { driveId: "drive-1" },
        });
      }

      if (path === "/teams/team-1/channels/channel-2/filesFolder") {
        return Promise.resolve({
          id: "folder-2",
          name: "Docs",
          parentReference: { driveId: "drive-1" },
        });
      }

      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });

    const roots = await resolveCloneRoots("team-1");

    expect(roots).toHaveLength(2);
    expect(roots[0]?.source).toBe("teams-channel");
    expect(roots[0]?.rootFolderId).toBe("folder-1");
  });

  it("resolves roots from folder fallback when channels endpoint is blocked", async () => {
    graphFetchMock.mockImplementation((path: string) => {
      if (path === "/teams/team-1/channels") {
        throw new GraphApiErrorMock(403, "Forbidden", "Forbidden");
      }

      if (path === "/groups/team-1/drive") {
        return Promise.resolve({ id: "drive-9" });
      }

      if (path === "/groups/team-1/drive/root/children") {
        return Promise.resolve({
          value: [
            { id: "folder-a", name: "General", folder: { childCount: 2 } },
            { id: "folder-b", name: "Forms", folder: { childCount: 1 } },
            { id: "folder-c", name: "Apps", folder: { childCount: 1 } },
          ],
        });
      }

      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });

    const roots = await resolveCloneRoots("team-1");

    expect(roots).toHaveLength(2);
    expect(roots.every((root) => root.source === "drive-folder")).toBe(true);
    expect(roots[0]?.driveId).toBe("drive-9");
  });
});

