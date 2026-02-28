import { beforeEach, describe, expect, it, vi } from "vitest";
import { tokenManager } from "@/auth/token-manager";

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

