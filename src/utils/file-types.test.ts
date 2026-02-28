import { describe, expect, it } from "vitest";
import type { DriveItem } from "@/types";
import { getFileTypeMeta } from "@/utils/file-types";

function createItem(name: string, folder = false): DriveItem {
  return {
    id: "1",
    name,
    webUrl: "https://example.com",
    lastModifiedDateTime: "2026-01-01T00:00:00.000Z",
    ...(folder ? { folder: { childCount: 1 } } : { file: { mimeType: "application/octet-stream" } }),
  };
}

describe("getFileTypeMeta", () => {
  it("maps known extensions", () => {
    expect(getFileTypeMeta(createItem("report.docx")).kind).toBe("word");
    expect(getFileTypeMeta(createItem("sheet.xlsx")).kind).toBe("excel");
    expect(getFileTypeMeta(createItem("deck.pptx")).kind).toBe("powerpoint");
  });

  it("maps folders", () => {
    expect(getFileTypeMeta(createItem("General", true)).kind).toBe("folder");
  });

  it("falls back to default", () => {
    expect(getFileTypeMeta(createItem("unknown.xyz")).kind).toBe("default");
  });
});

