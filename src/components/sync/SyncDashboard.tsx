import { useMemo, useState } from "react";
import { useTokenContext } from "@/auth/TokenContext";
import { ChannelMappingDialog } from "@/components/sync/ChannelMappingDialog";
import { ChannelMappings } from "@/components/sync/ChannelMappings";
import { QuickSetup } from "@/components/sync/QuickSetup";
import { SyncControls } from "@/components/sync/SyncControls";
import { SyncLog } from "@/components/sync/SyncLog";
import { useSyncEngine } from "@/hooks/useSyncEngine";
import { useSyncStore } from "@/stores/sync-store";
import type { ChannelMapping } from "@/types";

export function SyncDashboard() {
  const mappings = useSyncStore((state) => state.mappings);
  const syncErrors = useSyncStore((state) => state.syncErrors);
  const syncLog = useSyncStore((state) => state.syncLog);
  const syncRunning = useSyncStore((state) => state.syncRunning);
  const pollIntervalSeconds = useSyncStore((state) => state.pollIntervalSeconds);
  const autoPinWidget = useSyncStore((state) => state.autoPinWidget);

  const addMapping = useSyncStore((state) => state.addMapping);
  const removeMapping = useSyncStore((state) => state.removeMapping);
  const updateMapping = useSyncStore((state) => state.updateMapping);
  const setMappings = useSyncStore((state) => state.setMappings);
  const setPollInterval = useSyncStore((state) => state.setPollInterval);
  const setAutoPinWidget = useSyncStore((state) => state.setAutoPinWidget);
  const clearLog = useSyncStore((state) => state.clearLog);

  const { matrixStatus, matrixUserId } = useTokenContext();
  const { canRun, startSync, stopSync } = useSyncEngine();

  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);

  const lastRunAt = useMemo(() => syncLog[0]?.timestamp ?? null, [syncLog]);

  function handleMappingsCreated(nextMappings: ChannelMapping[]): void {
    const byChannel = new Map<string, ChannelMapping>();

    for (const mapping of mappings) {
      byChannel.set(mapping.channelId, mapping);
    }

    for (const mapping of nextMappings) {
      byChannel.set(mapping.channelId, mapping);
    }

    setMappings([...byChannel.values()]);
  }

  return (
    <div className="space-y-4 p-4">
      <section className="rounded-lg border border-border-default bg-app-surface p-4">
        <h2 className="text-base font-semibold text-text-primary">Teams to Element Sync</h2>
        <p className="mt-1 text-xs text-text-secondary">
          Sync runs only while this Sync tab is active. Switching to Files pauses syncing to preserve UI performance.
        </p>
        <p className="mt-2 text-xs text-text-tertiary">
          Matrix: {matrixStatus === "valid" ? `connected as ${matrixUserId}` : "not connected"}
        </p>
      </section>

      <SyncControls
        canRun={canRun}
        syncRunning={syncRunning}
        pollIntervalSeconds={pollIntervalSeconds}
        onPollIntervalChange={setPollInterval}
        onStart={startSync}
        onStop={stopSync}
        lastRunAt={lastRunAt}
      />

      <QuickSetup
        autoPinWidget={autoPinWidget}
        onAutoPinWidgetChange={setAutoPinWidget}
        onMappingsCreated={handleMappingsCreated}
        onStartSync={startSync}
      />

      <ChannelMappings
        mappings={mappings}
        syncErrors={syncErrors}
        onToggleEnabled={(mapping, enabled) => {
          updateMapping(mapping.channelId, { enabled });
        }}
        onRemove={(mapping) => {
          removeMapping(mapping.channelId);
        }}
        onOpenAddDialog={() => setMappingDialogOpen(true)}
      />

      <SyncLog entries={syncLog} onClear={clearLog} />

      <ChannelMappingDialog
        open={mappingDialogOpen}
        onOpenChange={setMappingDialogOpen}
        autoPinWidget={autoPinWidget}
        onAutoPinWidgetChange={setAutoPinWidget}
        onMappingCreated={(mapping) => {
          addMapping(mapping);
        }}
      />
    </div>
  );
}
