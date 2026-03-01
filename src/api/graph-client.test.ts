import { beforeEach, describe, expect, it, vi } from "vitest";
import { graphFetch, GraphApiError, TokenExpiredError } from "@/api/graph-client";
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

  it("exposes retryAfterMs for 429 responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Too Many Requests" } }), {
        status: 429,
        statusText: "Too Many Requests",
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "5",
        },
      }),
    );

    await expect(graphFetch("/me")).rejects.toMatchObject<Partial<GraphApiError>>({
      status: 429,
      retryAfterMs: 5000,
    });
  });
});

