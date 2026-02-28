import type { ChannelMapping } from "@/types";

interface ChannelMappingsProps {
  mappings: ChannelMapping[];
  syncErrors: Record<string, string>;
  onToggleEnabled: (mapping: ChannelMapping, enabled: boolean) => void;
  onRemove: (mapping: ChannelMapping) => void;
  onOpenAddDialog: () => void;
}

export function ChannelMappings({
  mappings,
  syncErrors,
  onToggleEnabled,
  onRemove,
  onOpenAddDialog,
}: ChannelMappingsProps) {
  return (
    <section className="rounded-lg border border-border-default bg-app-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Channel Mappings</h3>
        <button
          type="button"
          className="rounded bg-accent-primary px-3 py-1.5 text-xs text-white transition hover:bg-accent-hover"
          onClick={onOpenAddDialog}
        >
          Add channel mapping
        </button>
      </div>

      {mappings.length === 0 ? (
        <p className="text-xs text-text-secondary">No mappings configured.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border-default text-text-tertiary">
                <th className="px-2 py-1">Team</th>
                <th className="px-2 py-1">Channel</th>
                <th className="px-2 py-1">Room</th>
                <th className="px-2 py-1">Status</th>
                <th className="px-2 py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((mapping) => (
                <tr key={`${mapping.teamId}-${mapping.channelId}`} className="border-b border-border-subtle">
                  <td className="px-2 py-2 text-text-primary">{mapping.teamName}</td>
                  <td className="px-2 py-2 text-text-primary">{mapping.channelName}</td>
                  <td className="px-2 py-2 text-text-secondary">{mapping.matrixRoomId}</td>
                  <td className="px-2 py-2">
                    {syncErrors[mapping.channelId] ? (
                      <span className="text-token-expired">{syncErrors[mapping.channelId]}</span>
                    ) : mapping.enabled ? (
                      <span className="text-token-valid">Enabled</span>
                    ) : (
                      <span className="text-text-secondary">Paused</span>
                    )}
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
