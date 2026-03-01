import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_RETRY_DELAY_MS,
  computeBackoffWithJitter,
  parseRetryAfterMs,
} from "@/utils/retry";

describe("retry utilities", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parses numeric Retry-After as milliseconds", () => {
    expect(parseRetryAfterMs("3")).toBe(3000);
    expect(parseRetryAfterMs("0.5")).toBe(500);
  });

  it("parses date Retry-After as future delta", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));
    const ms = parseRetryAfterMs("Sun, 01 Mar 2026 00:00:05 GMT");
    expect(ms).toBe(5000);
    vi.useRealTimers();
  });

  it("computes bounded exponential backoff with jitter", () => {
    const value = computeBackoffWithJitter(4, 1000, 60_000);
    expect(value).toBeGreaterThanOrEqual(250);
    expect(value).toBeLessThanOrEqual(MAX_RETRY_DELAY_MS);
  });
});
