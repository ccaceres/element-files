import clsx from "clsx";
import { ItemActionsButton, ItemContextMenuWrapper } from "@/components/files/ContextMenu";
import { FileIcon } from "@/components/files/FileIcon";
import type { DriveItem } from "@/types";
import { formatFileSize, formatRelativeDate } from "@/utils/format";

interface FileRowProps {
  item: DriveItem;
  selected: boolean;
  onSelect: (item: DriveItem) => void;
  onOpenFolder: (item: DriveItem) => void;
  onDownload: (item: DriveItem) => void;
  onOpenInBrowser: (item: DriveItem) => void;
  onCopyLink: (item: DriveItem) => void;
  onDetails: (item: DriveItem) => void;
}

export function FileRow({
  item,
  selected,
  onSelect,
  onOpenFolder,
  onDownload,
  onOpenInBrowser,
  onCopyLink,
  onDetails,
}: FileRowProps) {
  const isFolder = Boolean(item.folder);

  const actions = {
    onOpen: (entry: DriveItem) => {
      if (entry.folder) {
        onOpenFolder(entry);
        return;
      }
      onOpenInBrowser(entry);
    },
    onDownload,
    onCopyLink,
    onDetails,
  };

  function handleDoubleClick(): void {
    if (isFolder) {
      onOpenFolder(item);
      return;
    }
    onDownload(item);
  }

  return (
    <ItemContextMenuWrapper item={item} actions={actions}>
      <div
        className={clsx(
          "grid h-[42px] cursor-pointer grid-cols-[40px_minmax(220px,1fr)_160px_160px_100px_80px] items-center gap-2 border-b border-border-subtle px-2 text-sm",
          selected ? "bg-app-selected" : "hover:bg-app-hover",
        )}
        onClick={() => onSelect(item)}
        onDoubleClick={handleDoubleClick}
        role="row"
        aria-selected={selected}
      >
        <div className="flex items-center justify-center">
          <FileIcon item={item} size="sm" />
        </div>
        <div className={clsx("truncate text-text-primary", isFolder ? "font-semibold" : "font-normal")}>
          {item.name}
        </div>
        <div className="truncate text-xs text-text-secondary">{formatRelativeDate(item.lastModifiedDateTime)}</div>
        <div className="truncate text-xs text-text-secondary">
          {item.lastModifiedBy?.user?.displayName ?? "-"}
        </div>
        <div className="truncate text-xs text-text-secondary">
          {isFolder ? "" : formatFileSize(item.size)}
        </div>
        <div className="flex justify-end">
          <ItemActionsButton item={item} actions={actions} />
        </div>
      </div>
    </ItemContextMenuWrapper>
  );
}

