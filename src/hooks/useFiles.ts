import { useQuery } from "@tanstack/react-query";
import { getFolderChildren } from "@/api/files";
import type { DriveItem } from "@/types";
import { sortDriveItems } from "@/utils/sort";

interface UseFilesParams {
  driveId: string | null;
  folderId: string | null;
  sortBy: "name" | "lastModifiedDateTime" | "size";
  sortDirection: "asc" | "desc";
}

export function useFiles({
  driveId,
  folderId,
  sortBy,
  sortDirection,
}: UseFilesParams) {
  return useQuery<DriveItem[]>({
    queryKey: ["files", driveId, folderId, sortBy, sortDirection],
    queryFn: async () => {
      const items = await getFolderChildren(driveId ?? "", folderId ?? "");
      return sortDriveItems(items, sortBy, sortDirection);
    },
    enabled: Boolean(driveId && folderId),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

