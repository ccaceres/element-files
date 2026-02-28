import { describe, expect, it } from "vitest";
import { GraphApiError, TokenExpiredError } from "@/api/graph-client";
import { mapGraphError } from "@/utils/errors";

describe("mapGraphError", () => {
  it("maps token expiration", () => {
    const result = mapGraphError(new TokenExpiredError());
    expect(result.title).toBe("Token expired");
  });

  it("maps forbidden error", () => {
    const result = mapGraphError(new GraphApiError(403, "Forbidden", "No access"), "channels");
    expect(result.description).toContain("permission to list channels");
  });

  it("maps forbidden file access error with scope guidance", () => {
    const result = mapGraphError(new GraphApiError(403, "Forbidden", "No access"), "files");
    expect(result.description).toContain("do not have access");
    expect(result.description).toContain("Files.Read.All");
  });

  it("maps not found error", () => {
    const result = mapGraphError(new GraphApiError(404, "Not Found", "Missing"));
    expect(result.description).toContain("does not have a files folder");
  });

  it("maps network error", () => {
    const result = mapGraphError(new TypeError("fetch failed"));
    expect(result.title).toBe("Network error");
  });
});

