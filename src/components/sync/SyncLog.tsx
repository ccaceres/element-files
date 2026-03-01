import { useMemo, useState } from "react";
import clsx from "clsx";
import type { FileCloneLogEntry, SyncLogEntry } from "@/types";

interface SyncLogProps {
  messageEntries: SyncLogEntry[];
  fileEntries: FileCloneLogEntry[];
  onClear: (kind: "messages" | "files") => void;
}

type LogFilter = "messages" | "files";

export function SyncLog({ messageEntries, fileEntries, onClear }: SyncLogProps) {
  const filesOnly = messageEntries.length === 0;
  const [filter, setFilter] = useState<LogFilter>("files");
  const entries = useMemo(
    () => (filter === "messages" ? messageEntries : fileEntries),
    [fileEntries, filter, messageEntries],
  );

  return (
    <section className="rounded-lg border border-border-default bg-app-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Sync Log</h3>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded border border-border-default bg-app-content p-0.5">
            {!filesOnly ? (
              <button
                type="button"
                className={clsx(
                  "rounded px-2 py-1 text-xs transition",
                  filter === "messages"
                    ? "bg-accent-primary text-white"
                    : "text-text-secondary hover:bg-app-hover",
                )}
                onClick={() => setFilter("messages")}
              >
                Messages
              </button>
            ) : null}
            <button
              type="button"
              className={clsx(
                "rounded px-2 py-1 text-xs transition",
                filter === "files"
                  ? "bg-accent-primary text-white"
                  : "text-text-secondary hover:bg-app-hover",
              )}
              onClick={() => setFilter("files")}
            >
              Files
            </button>
          </div>

          <button
            type="button"
            className="rounded border border-border-default px-2 py-1 text-xs text-text-secondary transition hover:bg-app-hover"
            onClick={() => onClear(filter)}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="max-h-64 space-y-2 overflow-auto pr-1">
        {entries.length === 0 ? (
          <p className="text-xs text-text-secondary">No sync activity yet.</p>
        ) : (
          entries.map((entry) => (
            <div
              key={`${entry.kind}-${entry.timestamp}-${entry.channelName}-${entry.messageCount}-${entry.action ?? "none"}`}
              className="rounded border border-border-subtle bg-app-content px-3 py-2 text-xs"
              title={entry.error}
            >
              <div className="flex items-center justify-between">
                <span className="text-text-tertiary">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span
                  className={clsx(
                    "font-semibold",
                    entry.status === "success" ? "text-token-valid" : "text-token-expired",
                  )}
                >
                  {entry.status === "success" ? "✓" : "✗"}
                </span>
              </div>
              <p className="mt-1 text-text-primary">{entry.channelName}</p>
              <p className="text-text-secondary">
                {entry.messageCount} {entry.kind === "files" ? "files" : "messages"}
                {entry.action ? ` • ${entry.action}` : ""}
              </p>
              {entry.path ? <p className="mt-1 text-text-tertiary">{entry.path}</p> : null}
              {entry.error ? (
                <p
                  className={clsx(
                    "mt-1",
                    /rate limited/i.test(entry.error) ? "text-token-warning" : "text-token-expired",
                  )}
                >
                  {entry.error}
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
