import clsx from "clsx";
import { ChatRegular, FolderRegular } from "@fluentui/react-icons";
import type { SyncTab } from "@/types";

interface TabBarProps {
  activeTab: SyncTab;
  onTabChange: (tab: SyncTab) => void;
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="border-b border-border-default bg-app-content px-4 py-2">
      <div className="inline-flex rounded border border-border-default bg-app-surface p-0.5">
        <button
          type="button"
          className={clsx(
            "inline-flex items-center gap-1 rounded px-3 py-1.5 text-sm transition",
            activeTab === "files"
              ? "bg-accent-primary text-white"
              : "text-text-secondary hover:bg-app-hover",
          )}
          onClick={() => onTabChange("files")}
        >
          <FolderRegular fontSize={14} /> Files
        </button>
        <button
          type="button"
          className={clsx(
            "inline-flex items-center gap-1 rounded px-3 py-1.5 text-sm transition",
            activeTab === "sync"
              ? "bg-accent-primary text-white"
              : "text-text-secondary hover:bg-app-hover",
          )}
          onClick={() => onTabChange("sync")}
        >
          <ChatRegular fontSize={14} /> Sync
        </button>
      </div>
    </div>
  );
}
