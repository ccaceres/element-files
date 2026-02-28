import clsx from "clsx";
import type { SyncLogEntry } from "@/types";

interface SyncLogProps {
  entries: SyncLogEntry[];
  onClear: () => void;
}

export function SyncLog({ entries, onClear }: SyncLogProps) {
  return (
    <section className="rounded-lg border border-border-default bg-app-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Sync Log</h3>
        <button
          type="button"
          className="rounded border border-border-default px-2 py-1 text-xs text-text-secondary transition hover:bg-app-hover"
          onClick={onClear}
        >
          Clear
        </button>
      </div>

      <div className="max-h-64 space-y-2 overflow-auto pr-1">
        {entries.length === 0 ? (
          <p className="text-xs text-text-secondary">No sync activity yet.</p>
        ) : (
          entries.map((entry) => (
            <div
              key={`${entry.timestamp}-${entry.channelName}-${entry.messageCount}`}
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
              <p className="text-text-secondary">{entry.messageCount} messages</p>
              {entry.error ? <p className="mt-1 text-token-expired">{entry.error}</p> : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
