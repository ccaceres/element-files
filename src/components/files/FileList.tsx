import type { DriveItem } from "@/types";
import { FileRow } from "@/components/files/FileRow";

interface FileListProps {
  items: DriveItem[];
  selectedItemId: string | null;
  onSelectItem: (item: DriveItem) => void;
  onOpenFolder: (item: DriveItem) => void;
  onDownload: (item: DriveItem) => void;
  onOpenInBrowser: (item: DriveItem) => void;
  onCopyLink: (item: DriveItem) => void;
  onDetails: (item: DriveItem) => void;
  onSendToElement?: (item: DriveItem) => void;
}

export function FileList({
  items,
  selectedItemId,
  onSelectItem,
  onOpenFolder,
  onDownload,
  onOpenInBrowser,
  onCopyLink,
  onDetails,
  onSendToElement,
}: FileListProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border-default bg-app-content">
      <div className="grid h-10 grid-cols-[40px_minmax(220px,1fr)_160px_160px_100px_80px] items-center gap-2 border-b border-border-default bg-app-surface px-2 text-[11px] font-semibold uppercase tracking-[0.5px] text-text-tertiary">
        <span className="text-center">Type</span>
        <span>Name</span>
        <span>Modified</span>
        <span>Modified By</span>
        <span>Size</span>
        <span className="text-right">Actions</span>
      </div>

      <div role="table" className="max-h-[calc(100vh-210px)] overflow-auto">
        {items.map((item) => (
          <FileRow
            key={item.id}
            item={item}
            selected={selectedItemId === item.id}
            onSelect={onSelectItem}
            onOpenFolder={onOpenFolder}
            onDownload={onDownload}
            onOpenInBrowser={onOpenInBrowser}
            onCopyLink={onCopyLink}
            onDetails={onDetails}
            onSendToElement={onSendToElement}
          />
        ))}
      </div>
    </div>
  );
}

