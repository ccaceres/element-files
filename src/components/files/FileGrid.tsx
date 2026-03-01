import { FileCard } from "@/components/files/FileCard";
import type { DriveItem } from "@/types";

interface FileGridProps {
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

export function FileGrid({
  items,
  selectedItemId,
  onSelectItem,
  onOpenFolder,
  onDownload,
  onOpenInBrowser,
  onCopyLink,
  onDetails,
  onSendToElement,
}: FileGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {items.map((item) => (
        <FileCard
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
  );
}

