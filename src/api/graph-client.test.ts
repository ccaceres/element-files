import { beforeEach, describe, expect, it, vi } from "vitest";
import { graphFetch, TokenExpiredError } from "@/api/graph-client";
import { tokenManager } from "@/auth/token-manager";

describe("graphFetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
    tokenManager.setToken("token-123");
  });

  it("sends bearer token in request headers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await graphFetch<{ ok: boolean }>("/me");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[1];
    const headers = new Headers(request?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-123");
  });

  it("throws TokenExpiredError and clears token on 401", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(graphFetch("/me")).rejects.toBeInstanceOf(TokenExpiredError);
    expect(tokenManager.getToken()).toBeNull();
  });
});

