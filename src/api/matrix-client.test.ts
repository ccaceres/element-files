import { beforeEach, describe, expect, it, vi } from "vitest";
import { matrixFetch, matrixUploadBlob, MatrixApiError } from "@/api/matrix-client";
import { matrixTokenManager } from "@/auth/token-manager";

function getConfiguredElementToken(): string | null {
  const fromDefine = typeof __ELEMENT_TOKEN__ !== "undefined" ? __ELEMENT_TOKEN__.trim() : "";
  return fromDefine || null;
}

describe("matrixFetch", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();

    matrixTokenManager.setHomeserver("https://matrix.bsdu.eu");
    matrixTokenManager.setToken("matrix-token");
  });

  it("sends matrix bearer token and normalized path", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await matrixFetch<{ ok: boolean }>("/v3/account/whoami");

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://matrix.bsdu.eu/_matrix/client/v3/account/whoami");

    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe(`Bearer ${matrixTokenManager.getToken()}`);
  });

  it("clears matrix token on 401", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(matrixFetch("/v3/account/whoami")).rejects.toBeInstanceOf(MatrixApiError);
    expect(matrixTokenManager.getToken()).toBe(getConfiguredElementToken());
  });

  it("exposes retryAfterMs on 429", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Too Many Requests" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "3",
        },
      }),
    );

    try {
      await matrixFetch("/v3/account/whoami");
    } catch (error) {
      expect(error).toBeInstanceOf(MatrixApiError);
      expect((error as MatrixApiError).retryAfterMs).toBe(3000);
    }
  });

  it("maps upload 413 payload too large", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "M_TOO_LARGE" }), {
        status: 413,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    await expect(matrixUploadBlob(new Blob(["x"]), "large.bin", "application/octet-stream")).rejects.toMatchObject({
      status: 413,
    });
  });

  it("falls back from media v3 to r0 upload endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/_matrix/media/r0/upload")) {
        return new Response(JSON.stringify({ content_uri: "mxc://matrix.bsdu.eu/abc123" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    });

    const result = await matrixUploadBlob(new Blob(["hello"]), "test.txt", "text/plain");
    expect(result.content_uri).toContain("mxc://");
    expect(
      fetchMock.mock.calls.some((call) => String(call[0]).includes("/_matrix/media/r0/upload")),
    ).toBe(true);
  });

  it("reports endpoint/auth/content-type details for upload failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", {
        status: 500,
      }),
    );

    await expect(
      matrixUploadBlob(new Blob(["hello"]), "change_tracker.xlsx", "application/octet-stream"),
    ).rejects.toMatchObject({
      status: 500,
    });

    try {
      await matrixUploadBlob(new Blob(["hello"]), "change_tracker.xlsx", "application/octet-stream");
    } catch (error) {
      expect(error).toBeInstanceOf(MatrixApiError);
      const message = (error as MatrixApiError).message;
      expect(message).toContain("endpoint=");
      expect(message).toContain("auth=");
    }
  });

  it("continues fallback attempts when fetch throws network errors", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ content_uri: "mxc://matrix.bsdu.eu/network-ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const result = await matrixUploadBlob(new Blob(["hello"]), "change_tracker.xlsx", "application/octet-stream");
    expect(result.content_uri).toBe("mxc://matrix.bsdu.eu/network-ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
