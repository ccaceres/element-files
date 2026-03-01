import clsx from "clsx";
import type { FileCloneMapping } from "@/types";

interface FileCloneMappingsProps {
  mappings: FileCloneMapping[];
  errors: Record<string, string>;
  onToggleEnabled: (mapping: FileCloneMapping, enabled: boolean) => void;
  onRemove: (mapping: FileCloneMapping) => void;
}

export function FileCloneMappings({
  mappings,
  errors,
  onToggleEnabled,
  onRemove,
}: FileCloneMappingsProps) {
  return (
    <section className="rounded-lg border border-border-default bg-app-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">File Clone Mappings</h3>

      {mappings.length === 0 ? (
        <p className="text-xs text-text-secondary">No file clone mappings configured.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border-default text-text-tertiary">
                <th className="px-2 py-1">Team</th>
                <th className="px-2 py-1">Space ID</th>
                <th className="px-2 py-1">Channel</th>
                <th className="px-2 py-1">Source</th>
                <th className="px-2 py-1">Room ID</th>
                <th className="px-2 py-1">Status</th>
                <th className="px-2 py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((mapping) => (
                <tr key={mapping.id} className="border-b border-border-subtle">
                  <td className="px-2 py-2 text-text-primary">{mapping.teamName}</td>
                  <td className="px-2 py-2 font-mono text-text-secondary">{mapping.matrixSpaceId}</td>
                  <td className="px-2 py-2 text-text-primary">
                    <span>{mapping.channelLabel}</span>
                    {mapping.canonical ? (
                      <span className="ml-2 rounded bg-accent-light px-1.5 py-0.5 text-[10px] text-accent-primary">
                        Canonical
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2">
                    <span
                      className={clsx(
                        "rounded px-2 py-0.5",
                        mapping.source === "teams-channel"
                          ? "bg-accent-light text-accent-primary"
                          : "bg-app-content text-text-secondary",
                      )}
                    >
                      {mapping.source}
                    </span>
                  </td>
                  <td className="px-2 py-2 font-mono text-text-secondary">{mapping.matrixRoomId}</td>
                  <td className="px-2 py-2">
                    {errors[mapping.id] ? (
                      <span className="text-token-expired">{errors[mapping.id]}</span>
                    ) : mapping.enabled ? (
                      <span className="text-token-valid">Enabled</span>
                    ) : (
                      <span className="text-text-secondary">Paused</span>
                    )}
                    {mapping.health && mapping.health !== "ok" ? (
                      <span className="ml-2 text-token-warning">({mapping.health})</span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded border border-border-default px-2 py-1 text-xs text-text-secondary transition hover:bg-app-hover"
                        onClick={() => onToggleEnabled(mapping, !mapping.enabled)}
                      >
                        {mapping.enabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        type="button"
                        className="rounded border border-border-default px-2 py-1 text-xs text-token-expired transition hover:bg-app-hover"
                        onClick={() => onRemove(mapping)}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
