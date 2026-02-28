import { describe, expect, it } from "vitest";
import { normalizeAccessToken } from "@/auth/token-format";

describe("normalizeAccessToken", () => {
  it("removes Bearer prefix and whitespace", () => {
    expect(normalizeAccessToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(normalizeAccessToken("  Bearer   abc.def.ghi  ")).toBe("abc.def.ghi");
  });

  it("removes wrapping quotes", () => {
    expect(normalizeAccessToken('"abc.def.ghi"')).toBe("abc.def.ghi");
    expect(normalizeAccessToken("'abc.def.ghi'")).toBe("abc.def.ghi");
  });

  it("collapses line breaks and spaces inside pasted token", () => {
    expect(normalizeAccessToken("abc.\n def.\r\nghi")).toBe("abc.def.ghi");
  });
});

