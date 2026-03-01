import clsx from "clsx";
import { ItemActionsButton, ItemContextMenuWrapper } from "@/components/files/ContextMenu";
import { FileIcon } from "@/components/files/FileIcon";
import type { DriveItem } from "@/types";
import { formatRelativeDate } from "@/utils/format";

interface FileCardProps {
  item: DriveItem;
  selected: boolean;
  onSelect: (item: DriveItem) => void;
  onOpenFolder: (item: DriveItem) => void;
  onDownload: (item: DriveItem) => void;
  onOpenInBrowser: (item: DriveItem) => void;
  onCopyLink: (item: DriveItem) => void;
  onDetails: (item: DriveItem) => void;
  onSendToElement?: (item: DriveItem) => void;
}

export function FileCard({
  item,
  selected,
  onSelect,
  onOpenFolder,
  onDownload,
  onOpenInBrowser,
  onCopyLink,
  onDetails,
  onSendToElement,
}: FileCardProps) {
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
    onSendToElement,
  };

  function handleDoubleClick(): void {
    if (item.folder) {
      onOpenFolder(item);
      return;
    }
    onDownload(item);
  }

  return (
    <ItemContextMenuWrapper item={item} actions={actions}>
      <div
        className={clsx(
          "group relative rounded-lg border border-border-default bg-app-surface p-3 transition hover:bg-app-hover",
          selected ? "ring-1 ring-accent-primary" : "",
        )}
        onClick={() => onSelect(item)}
        onDoubleClick={handleDoubleClick}
      >
        <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100">
          <ItemActionsButton item={item} actions={actions} />
        </div>

        <div className="mb-3 flex h-16 items-center justify-center">
          <FileIcon item={item} size="lg" />
        </div>

        <p className={clsx("truncate text-sm text-text-primary", item.folder ? "font-semibold" : "font-medium")}>
          {item.name}
        </p>
        <p className="mt-1 text-xs text-text-secondary">{formatRelativeDate(item.lastModifiedDateTime)}</p>
        {item.folder ? (
          <p className="mt-1 text-xs text-text-tertiary">
            {item.folder.childCount} item{item.folder.childCount === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>
    </ItemContextMenuWrapper>
  );
}

