import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchDrive } from "@/api/files";
import type { DriveItem, SortBy, SortDirection } from "@/types";
import { sortDriveItems } from "@/utils/sort";

interface UseSearchParams {
  driveId: string | null;
  query: string;
  sortBy: SortBy;
  sortDirection: SortDirection;
}

export function useSearch({
  driveId,
  query,
  sortBy,
  sortDirection,
}: UseSearchParams) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [query]);

  return useQuery<DriveItem[]>({
    queryKey: ["search", driveId, debouncedQuery, sortBy, sortDirection],
    queryFn: async () => {
      const items = await searchDrive(driveId ?? "", debouncedQuery);
      return sortDriveItems(items, sortBy, sortDirection);
    },
    enabled: Boolean(driveId && debouncedQuery.length > 0),
    staleTime: 15 * 1000,
    gcTime: 60 * 1000,
  });
}

