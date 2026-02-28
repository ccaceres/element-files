import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DetailsPanel } from "@/components/files/DetailsPanel";
import type { DriveItem } from "@/types";
import { getItemFields, getThumbnailUrl } from "@/api/files";

vi.mock("@/api/files", () => ({
  getItemFields: vi.fn(),
  getThumbnailUrl: vi.fn(),
}));

const mockedGetItemFields = vi.mocked(getItemFields);
const mockedGetThumbnailUrl = vi.mocked(getThumbnailUrl);

const item: DriveItem = {
  id: "file-1",
  name: "plan.docx",
  webUrl: "https://example.com/plan.docx",
  lastModifiedDateTime: "2026-01-01T00:00:00.000Z",
  file: { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
};

describe("DetailsPanel", () => {
  it("renders fallback metadata state when fields are unavailable", async () => {
    mockedGetItemFields.mockResolvedValue(null);
    mockedGetThumbnailUrl.mockResolvedValue(null);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <DetailsPanel open item={item} driveId="drive-1" onOpenChange={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("SharePoint fields")).toBeInTheDocument();
    expect(
      await screen.findByText("No custom SharePoint fields available for this item."),
    ).toBeInTheDocument();
  });
});

