import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSearch } from "@/hooks/useSearch";
import { searchDrive } from "@/api/files";

vi.mock("@/api/files", () => ({
  searchDrive: vi.fn(),
}));

const mockedSearchDrive = vi.mocked(searchDrive);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useSearch", () => {
  beforeEach(() => {
    vi.useRealTimers();
    mockedSearchDrive.mockReset();
    mockedSearchDrive.mockResolvedValue([]);
  });

  it("debounces search calls by 300ms", async () => {
    const wrapper = createWrapper();
    const hook = renderHook(
      ({ query }) => useSearch({ driveId: "drive-1", query, sortBy: "name", sortDirection: "asc" }),
      {
        wrapper,
        initialProps: { query: "" },
      },
    );

    hook.rerender({ query: "budget" });

    await new Promise((resolve) => {
      setTimeout(resolve, 250);
    });
    expect(mockedSearchDrive).not.toHaveBeenCalled();

    await new Promise((resolve) => {
      setTimeout(resolve, 120);
    });

    await waitFor(() => {
      expect(mockedSearchDrive).toHaveBeenCalledWith("drive-1", "budget");
    });
  });
});

