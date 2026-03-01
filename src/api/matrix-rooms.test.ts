import { beforeEach, describe, expect, it, vi } from "vitest";

const matrixFetchMock = vi.fn();
const matrixUploadBlobMock = vi.fn();

vi.mock("@/api/matrix-client", () => {
  class MatrixApiError extends Error {
    status: number;
    retryAfterMs?: number;

    constructor(status: number, message: string, retryAfterMs?: number) {
      super(message);
      this.name = "MatrixApiError";
      this.status = status;
      this.retryAfterMs = retryAfterMs;
    }
  }

  return {
    MatrixApiError,
    matrixFetch: (...args: unknown[]) => matrixFetchMock(...args),
    matrixUploadBlob: (...args: unknown[]) => matrixUploadBlobMock(...args),
  };
});

import { MatrixApiError } from "@/api/matrix-client";
import { sendFile } from "@/api/matrix-rooms";

describe("sendFile", () => {
  beforeEach(() => {
    matrixFetchMock.mockReset();
    matrixUploadBlobMock.mockReset();
  });

  it("retries send with minimal payload when metadata payload fails with 500", async () => {
    matrixUploadBlobMock.mockResolvedValue({ content_uri: "mxc://matrix.bsdu.eu/abc" });
    matrixFetchMock
      .mockRejectedValueOnce(new MatrixApiError(500, "Internal server error"))
      .mockResolvedValueOnce({ event_id: "$event" });

    const result = await sendFile("!room:matrix.bsdu.eu", new Blob(["hello"]), {
      filename: "change_tracker.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: 1234,
      path: "/A/B/change_tracker.xlsx",
      channel: "General",
      driveItemId: "item-1",
    });

    expect(result.event_id).toBe("$event");
    expect(matrixFetchMock).toHaveBeenCalledTimes(2);

    const firstBody = matrixFetchMock.mock.calls[0]?.[1]?.body as Record<string, unknown>;
    const secondBody = matrixFetchMock.mock.calls[1]?.[1]?.body as Record<string, unknown>;

    expect(firstBody["org.icclab.teams.path"]).toBe("/A/B/change_tracker.xlsx");
    expect(firstBody["org.icclab.teams.driveItemId"]).toBe("item-1");
    expect(secondBody["org.icclab.teams.path"]).toBeUndefined();
    expect(secondBody["org.icclab.teams.driveItemId"]).toBeUndefined();
  });

  it("wraps upload failures with phase=upload", async () => {
    matrixUploadBlobMock.mockRejectedValue(new MatrixApiError(500, "Internal server error"));

    await expect(
      sendFile("!room:matrix.bsdu.eu", new Blob(["hello"]), {
        filename: "f.txt",
      }),
    ).rejects.toMatchObject({
      name: "MatrixFileSendError",
      phase: "upload",
    });
  });
});
