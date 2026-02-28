import { beforeEach, describe, expect, it, vi } from "vitest";
import { matrixFetch, MatrixApiError } from "@/api/matrix-client";
import { matrixTokenManager } from "@/auth/token-manager";

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
    expect(headers.get("Authorization")).toBe("Bearer matrix-token");
  });

  it("clears matrix token on 401", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(matrixFetch("/v3/account/whoami")).rejects.toBeInstanceOf(MatrixApiError);
    expect(matrixTokenManager.getToken()).toBeNull();
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
});
