import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FileRow } from "@/components/files/FileRow";
import type { DriveItem } from "@/types";

const fileItem: DriveItem = {
  id: "file-1",
  name: "plan.docx",
  webUrl: "https://example.com/plan.docx",
  lastModifiedDateTime: "2026-01-01T00:00:00.000Z",
  file: { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
};

describe("FileRow context actions", () => {
  it("calls copy link action", async () => {
    const user = userEvent.setup();
    const onCopyLink = vi.fn();

    render(
      <FileRow
        item={fileItem}
        selected={false}
        onSelect={vi.fn()}
        onOpenFolder={vi.fn()}
        onDownload={vi.fn()}
        onOpenInBrowser={vi.fn()}
        onCopyLink={onCopyLink}
        onDetails={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open file actions" }));
    await user.click(await screen.findByText("Copy link"));

    expect(onCopyLink).toHaveBeenCalledWith(fileItem);
  });
});

