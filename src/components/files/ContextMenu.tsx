import * as ContextMenu from "@radix-ui/react-context-menu";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontalRegular } from "@fluentui/react-icons";
import type { DriveItem } from "@/types";
import type { PropsWithChildren } from "react";

interface ItemMenuActions {
  onOpen: (item: DriveItem) => void;
  onDownload: (item: DriveItem) => void;
  onCopyLink: (item: DriveItem) => void;
  onDetails: (item: DriveItem) => void;
  onSendToElement?: (item: DriveItem) => void;
}

interface ContextMenuWrapperProps extends PropsWithChildren {
  item: DriveItem;
  actions: ItemMenuActions;
}

function MenuContent({ item, actions }: { item: DriveItem; actions: ItemMenuActions }) {
  const isFolder = Boolean(item.folder);

  return (
    <>
      <ContextMenu.Item
        className="menu-item"
        onSelect={() => {
          actions.onOpen(item);
        }}
      >
        {isFolder ? "Open" : "Open in browser"}
      </ContextMenu.Item>
      {!isFolder ? (
        <ContextMenu.Item
          className="menu-item"
          onSelect={() => {
            actions.onDownload(item);
          }}
        >
          Download
        </ContextMenu.Item>
      ) : null}
      <ContextMenu.Item
        className="menu-item"
        onSelect={() => {
          actions.onCopyLink(item);
        }}
      >
        Copy link
      </ContextMenu.Item>
      {!isFolder && actions.onSendToElement ? (
        <ContextMenu.Item
          className="menu-item"
          onSelect={() => {
            actions.onSendToElement?.(item);
          }}
        >
          Send to Element room
        </ContextMenu.Item>
      ) : null}
      {!isFolder ? (
        <ContextMenu.Item
          className="menu-item"
          onSelect={() => {
            actions.onDetails(item);
          }}
        >
          Details
        </ContextMenu.Item>
      ) : null}
    </>
  );
}

function DropdownContent({ item, actions }: { item: DriveItem; actions: ItemMenuActions }) {
  const isFolder = Boolean(item.folder);

  return (
    <>
      <DropdownMenu.Item
        className="menu-item"
        onSelect={() => {
          actions.onOpen(item);
        }}
      >
        {isFolder ? "Open" : "Open in browser"}
      </DropdownMenu.Item>
      {!isFolder ? (
        <DropdownMenu.Item
          className="menu-item"
          onSelect={() => {
            actions.onDownload(item);
          }}
        >
          Download
        </DropdownMenu.Item>
      ) : null}
      <DropdownMenu.Item
        className="menu-item"
        onSelect={() => {
          actions.onCopyLink(item);
        }}
      >
        Copy link
      </DropdownMenu.Item>
      {!isFolder && actions.onSendToElement ? (
        <DropdownMenu.Item
          className="menu-item"
          onSelect={() => {
            actions.onSendToElement?.(item);
          }}
        >
          Send to Element room
        </DropdownMenu.Item>
      ) : null}
      {!isFolder ? (
        <DropdownMenu.Item
          className="menu-item"
          onSelect={() => {
            actions.onDetails(item);
          }}
        >
          Details
        </DropdownMenu.Item>
      ) : null}
    </>
  );
}

export function ItemContextMenuWrapper({
  children,
  item,
  actions,
}: ContextMenuWrapperProps) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="menu-content" alignOffset={4}>
          <MenuContent item={item} actions={actions} />
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

interface ItemActionsButtonProps {
  item: DriveItem;
  actions: ItemMenuActions;
}

export function ItemActionsButton({ item, actions }: ItemActionsButtonProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="rounded p-1 text-text-tertiary transition hover:bg-app-hover hover:text-text-primary"
          aria-label="Open file actions"
        >
          <MoreHorizontalRegular fontSize={16} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu-content" sideOffset={6} align="end">
          <DropdownContent item={item} actions={actions} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export type { ItemMenuActions };

