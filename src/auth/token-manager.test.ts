import { beforeEach, describe, expect, it, vi } from "vitest";
import { matrixTokenManager, tokenManager } from "@/auth/token-manager";

describe("tokenManager", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("stores and retrieves token", () => {
    tokenManager.setToken("abc");
    expect(tokenManager.getToken()).toBe("abc");
  });

  it("clears token and timestamp", () => {
    tokenManager.setToken("abc");
    tokenManager.clearToken();
    expect(tokenManager.getToken()).toBeNull();
    expect(tokenManager.getTokenAge()).toBe(Number.POSITIVE_INFINITY);
  });

  it("marks token as likely expired after threshold", () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(1_000_000);
    tokenManager.setToken("abc");

    nowSpy.mockReturnValue(1_000_000 + 56 * 60 * 1000);
    expect(tokenManager.isLikelyExpired()).toBe(true);
  });
});

describe("matrixTokenManager", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("stores and clears matrix token", () => {
    matrixTokenManager.setToken("matrix-abc");
    expect(matrixTokenManager.getToken()).toBe("matrix-abc");

    matrixTokenManager.clearToken();
    expect(matrixTokenManager.getToken()).toBeNull();
  });

  it("uses default homeserver and supports override", () => {
    expect(matrixTokenManager.getHomeserver()).toBe("https://matrix.bsdu.eu");

    matrixTokenManager.setHomeserver("https://matrix.example.org");
    expect(matrixTokenManager.getHomeserver()).toBe("https://matrix.example.org");
  });

  it("emits set and clear events", () => {
    const listener = vi.fn();
    const unsubscribe = matrixTokenManager.subscribe(listener);

    matrixTokenManager.setToken("matrix-abc");
    matrixTokenManager.clearToken();

    expect(listener).toHaveBeenNthCalledWith(1, { type: "set", token: "matrix-abc" });
    expect(listener).toHaveBeenNthCalledWith(2, { type: "clear" });

    unsubscribe();
  });
});

