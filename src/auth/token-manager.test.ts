import { beforeEach, describe, expect, it, vi } from "vitest";
import { matrixTokenManager, tokenManager } from "@/auth/token-manager";

function getConfiguredElementToken(): string | null {
  const fromDefine = typeof __ELEMENT_TOKEN__ !== "undefined" ? __ELEMENT_TOKEN__.trim() : "";
  return fromDefine || null;
}

function getConfiguredHomeserver(): string | null {
  const fromDefine =
    typeof __MATRIX_SERVER_URL__ !== "undefined" ? __MATRIX_SERVER_URL__.trim() : "";
  return fromDefine || null;
}

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
    const configured = getConfiguredElementToken();

    matrixTokenManager.setToken("matrix-abc");
    expect(matrixTokenManager.getToken()).toBe(configured ?? "matrix-abc");

    matrixTokenManager.clearToken();
    expect(matrixTokenManager.getToken()).toBe(configured);
  });

  it("uses default homeserver and supports override", () => {
    const configured = getConfiguredHomeserver();
    expect(matrixTokenManager.getHomeserver()).toBe(configured ?? "https://matrix.bsdu.eu");

    matrixTokenManager.setHomeserver("https://matrix.example.org");
    expect(matrixTokenManager.getHomeserver()).toBe(configured ?? "https://matrix.example.org");
  });

  it("emits set and clear events", () => {
    const configured = getConfiguredElementToken();
    const listener = vi.fn();
    const unsubscribe = matrixTokenManager.subscribe(listener);

    matrixTokenManager.setToken("matrix-abc");
    matrixTokenManager.clearToken();

    expect(listener).toHaveBeenNthCalledWith(1, { type: "set", token: configured ?? "matrix-abc" });
    expect(listener).toHaveBeenNthCalledWith(
      2,
      configured ? { type: "set", token: configured } : { type: "clear" },
    );

    unsubscribe();
  });
});

