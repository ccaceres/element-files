import { beforeEach, describe, expect, it, vi } from "vitest";
import { GraphApiError } from "@/api/graph-client";
import { MatrixApiError } from "@/api/matrix-client";
import { useSyncStore } from "@/stores/sync-store";
import { fileCloneEngine } from "@/sync/file-clone-engine";
import type { FileCloneMapping } from "@/types";

const listFolderTreeMock = vi.fn();
const getFileContentBlobMock = vi.fn();
const sendFileMock = vi.fn();
const sendCloneNoticeMock = vi.fn();

vi.mock("@/api/files", () => ({
  listFolderTree: (...args: unknown[]) => listFolderTreeMock(...args),
  getFileContentBlob: (...args: unknown[]) => getFileContentBlobMock(...args),
}));

vi.mock("@/api/matrix-rooms", () => ({
  sendFile: (...args: unknown[]) => sendFileMock(...args),
  sendCloneNotice: (...args: unknown[]) => sendCloneNoticeMock(...args),
  MatrixFileSendError: class MatrixFileSendError extends Error {
    phase: "upload" | "send";
    cause: unknown;

    constructor(phase: "upload" | "send", cause: unknown) {
      super(cause instanceof Error ? cause.message : "Mock matrix file send error");
      this.name = "MatrixFileSendError";
      this.phase = phase;
      this.cause = cause;
    }
  },
}));

function makeMapping(overrides?: Partial<FileCloneMapping>): FileCloneMapping {
  return {
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
    ...overrides,
  };
}

describe("fileCloneEngine", () => {
  beforeEach(() => {
    listFolderTreeMock.mockReset();
    getFileContentBlobMock.mockReset();
    sendFileMock.mockReset();
    sendCloneNoticeMock.mockReset();

    getFileContentBlobMock.mockResolvedValue(new Blob(["test"]));
    sendFileMock.mockResolvedValue({ event_id: "$event" });
    sendCloneNoticeMock.mockResolvedValue({ event_id: "$notice" });

    useSyncStore.setState((state) => ({
      ...state,
      fileCloneMappings: [],
      fileCloneErrors: {},
      fileCloneLog: [],
      fileCloneStateIndex: {},
    }));
  });

  it("initial clone uploads full folder tree and stores state index", async () => {
    const mapping = makeMapping();
    useSyncStore.getState().setFileCloneMappings([mapping]);

    listFolderTreeMock.mockResolvedValue([
      {
        id: "file-1",
        name: "A.docx",
        path: "/General/A.docx",
        size: 100,
        lastModifiedDateTime: "2026-02-28T10:00:00Z",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        webUrl: "https://example.com/A.docx",
      },
      {
        id: "file-2",
        name: "B.pdf",
        path: "/General/B.pdf",
        size: 200,
        lastModifiedDateTime: "2026-02-28T10:00:01Z",
        mimeType: "application/pdf",
        webUrl: "https://example.com/B.pdf",
      },
    ]);

    const stats = await fileCloneEngine.runInitialClone(mapping);

    expect(stats.uploaded).toBe(2);
    expect(sendFileMock).toHaveBeenCalledTimes(2);
    const stateIndex = useSyncStore.getState().fileCloneStateIndex[mapping.id];
    expect(Object.keys(stateIndex ?? {})).toHaveLength(2);
    expect(stateIndex?.["file-1"]?.path).toBe("/General/A.docx");
  });

  it("delta clone uploads new/updated files and handles deletes", async () => {
    const mapping = makeMapping();
    useSyncStore.getState().setFileCloneMappings([mapping]);
    useSyncStore.getState().setFileCloneMappingState(mapping.id, {
      "file-1": {
        driveItemId: "file-1",
        path: "/General/A.docx",
        lastModifiedDateTime: "2026-02-28T10:00:00Z",
        size: 100,
      },
      "file-2": {
        driveItemId: "file-2",
        path: "/General/B.pdf",
        lastModifiedDateTime: "2026-02-28T10:00:00Z",
        size: 200,
      },
      "file-3": {
        driveItemId: "file-3",
        path: "/General/C.txt",
        lastModifiedDateTime: "2026-02-28T10:00:00Z",
        size: 20,
      },
    });

    listFolderTreeMock.mockResolvedValue([
      {
        id: "file-1",
        name: "A.docx",
        path: "/General/A.docx",
        size: 100,
        lastModifiedDateTime: "2026-02-28T10:00:00Z",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        webUrl: "https://example.com/A.docx",
      },
      {
        id: "file-2",
        name: "B.pdf",
        path: "/General/B.pdf",
        size: 222,
        lastModifiedDateTime: "2026-02-28T10:05:00Z",
        mimeType: "application/pdf",
        webUrl: "https://example.com/B.pdf",
      },
      {
        id: "file-4",
        name: "D.png",
        path: "/General/D.png",
        size: 50,
        lastModifiedDateTime: "2026-02-28T10:06:00Z",
        mimeType: "image/png",
        webUrl: "https://example.com/D.png",
      },
    ]);

    const stats = await fileCloneEngine.runDeltaTick(mapping);

    expect(stats.uploaded).toBe(1);
    expect(stats.updated).toBe(1);
    expect(stats.deleted).toBe(1);
    expect(sendFileMock).toHaveBeenCalledTimes(2);

    const stateIndex = useSyncStore.getState().fileCloneStateIndex[mapping.id];
    expect(stateIndex?.["file-4"]).toBeDefined();
    expect(stateIndex?.["file-3"]).toBeUndefined();
  });

  it("skips cloning when mapping is disabled", async () => {
    const mapping = makeMapping({ enabled: false });
    useSyncStore.getState().setFileCloneMappings([mapping]);

    listFolderTreeMock.mockResolvedValue([
      {
        id: "file-1",
        name: "A.docx",
        path: "/General/A.docx",
        size: 100,
        lastModifiedDateTime: "2026-02-28T10:00:00Z",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        webUrl: "https://example.com/A.docx",
      },
    ]);

    const stats = await fileCloneEngine.runInitialClone(mapping);
    expect(stats.uploaded).toBe(0);
    expect(sendFileMock).not.toHaveBeenCalled();
  });

  it("does not run mappings without a matrix space id", async () => {
    const mapping = makeMapping({ matrixSpaceId: "" });
    useSyncStore.getState().setFileCloneMappings([mapping]);

    listFolderTreeMock.mockResolvedValue([
      {
        id: "file-1",
        name: "A.docx",
        path: "/General/A.docx",
        size: 100,
        lastModifiedDateTime: "2026-02-28T10:00:00Z",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        webUrl: "https://example.com/A.docx",
      },
    ]);

    const stats = await fileCloneEngine.runDeltaTick(mapping);
    expect(stats.uploaded).toBe(0);
    expect(sendFileMock).not.toHaveBeenCalled();
  });

  it("stores failed status and retryAfter on matrix upload failures", async () => {
    const mapping = makeMapping();
    useSyncStore.getState().setFileCloneMappings([mapping]);

    listFolderTreeMock.mockResolvedValue([
      {
        id: "file-err",
        name: "change_tracker.xlsx",
        path: "/OTP-Management/OTP-Management-KPIs/change_tracker.xlsx",
        size: 123,
        lastModifiedDateTime: "2026-02-28T20:10:00Z",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        webUrl: "https://sharepoint.example/change_tracker.xlsx",
      },
    ]);

    sendFileMock.mockRejectedValueOnce(new MatrixApiError(500, "Internal server error"));

    const stats = await fileCloneEngine.runDeltaTick(mapping);
    expect(stats.errors).toBe(1);
    expect(stats.skipped).toBe(0);

    const stored = useSyncStore.getState().fileCloneStateIndex[mapping.id]?.["file-err"];
    expect(stored?.lastCloneStatus).toBe("failed");
    expect(stored?.lastSentEventId ?? null).toBeNull();
    expect(typeof stored?.retryAfter).toBe("string");
  });

  it("retries failed items once retryAfter has passed", async () => {
    const mapping = makeMapping();
    useSyncStore.getState().setFileCloneMappings([mapping]);
    useSyncStore.getState().setFileCloneMappingState(mapping.id, {
      "file-err": {
        driveItemId: "file-err",
        path: "/OTP-Management/OTP-Management-KPIs/change_tracker.xlsx",
        lastModifiedDateTime: "2026-02-28T20:10:00Z",
        size: 123,
        lastCloneStatus: "failed",
        lastError: "upload failed: Internal server error",
        lastAttemptedAt: "2000-01-01T00:00:00Z",
        retryAfter: "2000-01-01T00:00:01Z",
      },
    });

    listFolderTreeMock.mockResolvedValue([
      {
        id: "file-err",
        name: "change_tracker.xlsx",
        path: "/OTP-Management/OTP-Management-KPIs/change_tracker.xlsx",
        size: 123,
        lastModifiedDateTime: "2026-02-28T20:10:00Z",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        webUrl: "https://example.com/change_tracker.xlsx",
      },
    ]);

    sendFileMock.mockResolvedValue({ event_id: "$event" });

    const stats = await fileCloneEngine.runDeltaTick(mapping);
    expect(stats.uploaded).toBe(1);
    expect(sendFileMock).toHaveBeenCalledTimes(1);

    const stored = useSyncStore.getState().fileCloneStateIndex[mapping.id]?.["file-err"];
    expect(stored?.lastCloneStatus).toBeUndefined();
    expect(stored?.retryAfter).toBeNull();
  });

  it("stores failed status on graph download errors", async () => {
    const mapping = makeMapping();
    useSyncStore.getState().setFileCloneMappings([mapping]);

    listFolderTreeMock.mockResolvedValue([
      {
        id: "file-err",
        name: "change_tracker.xlsx",
        path: "/OTP-Management/OTP-Management-KPIs/change_tracker.xlsx",
        size: 123,
        lastModifiedDateTime: "2026-02-28T20:10:00Z",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        webUrl: "https://sharepoint.example/change_tracker.xlsx",
      },
    ]);

    getFileContentBlobMock.mockRejectedValueOnce(
      new GraphApiError(500, "Internal Server Error", "Internal server error"),
    );

    const stats = await fileCloneEngine.runDeltaTick(mapping);
    expect(stats.errors).toBe(1);
    expect(stats.skipped).toBe(0);
    const stored = useSyncStore.getState().fileCloneStateIndex[mapping.id]?.["file-err"];
    expect(stored?.lastCloneStatus).toBe("failed");
  });
});
