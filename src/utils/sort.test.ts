import { describe, expect, it } from "vitest";
import type { DriveItem } from "@/types";
import { sortDriveItems } from "@/utils/sort";

function item(partial: Partial<DriveItem>): DriveItem {
  return {
    id: partial.id ?? crypto.randomUUID(),
    name: partial.name ?? "name",
    webUrl: "https://example.com",
    lastModifiedDateTime: partial.lastModifiedDateTime ?? "2026-01-01T00:00:00.000Z",
    size: partial.size,
    file: partial.file,
    folder: partial.folder,
  };
}

describe("sortDriveItems", () => {
  it("always keeps folders before files", () => {
    const sorted = sortDriveItems(
      [
        item({ name: "z-file.txt", file: { mimeType: "text/plain" } }),
        item({ name: "a-folder", folder: { childCount: 1 } }),
      ],
      "name",
      "asc",
    );

    expect(sorted[0]?.folder).toBeDefined();
    expect(sorted[1]?.file).toBeDefined();
  });

  it("sorts by size descending within each type group", () => {
    const sorted = sortDriveItems(
      [
        item({ name: "a.txt", size: 10, file: { mimeType: "text/plain" } }),
        item({ name: "b.txt", size: 100, file: { mimeType: "text/plain" } }),
      ],
      "size",
      "desc",
    );

    expect(sorted[0]?.name).toBe("b.txt");
  });
});

