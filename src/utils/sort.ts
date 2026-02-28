import type { DriveItem, SortBy, SortDirection } from "@/types";

function compareBySortField(a: DriveItem, b: DriveItem, sortBy: SortBy): number {
  if (sortBy === "name") {
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  }

  if (sortBy === "lastModifiedDateTime") {
    const left = new Date(a.lastModifiedDateTime).getTime();
    const right = new Date(b.lastModifiedDateTime).getTime();
    return left - right;
  }

  const left = a.size ?? -1;
  const right = b.size ?? -1;
  return left - right;
}

export function sortDriveItems(
  items: DriveItem[],
  sortBy: SortBy,
  direction: SortDirection,
): DriveItem[] {
  const sorted = [...items].sort((a, b) => {
    const aFolder = Boolean(a.folder);
    const bFolder = Boolean(b.folder);

    if (aFolder !== bFolder) {
      return aFolder ? -1 : 1;
    }

    const comparison = compareBySortField(a, b, sortBy);
    return direction === "asc" ? comparison : -comparison;
  });

  return sorted;
}

