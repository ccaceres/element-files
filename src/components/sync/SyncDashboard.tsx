import { useMemo } from "react";
import { useTokenContext } from "@/auth/TokenContext";
import { FileCloneControls } from "@/components/sync/FileCloneControls";
import { FileCloneMappings } from "@/components/sync/FileCloneMappings";
import { QuickSetup } from "@/components/sync/QuickSetup";
import { SyncLog } from "@/components/sync/SyncLog";
import { useFileCloneEngine } from "@/hooks/useFileCloneEngine";
import { useSyncStore } from "@/stores/sync-store";
import type { FileCloneMapping, TeamSpaceMapping } from "@/types";

export function SyncDashboard() {
  const fileCloneMappings = useSyncStore((state) => state.fileCloneMappings);
  const fileCloneErrors = useSyncStore((state) => state.fileCloneErrors);
  const fileCloneLog = useSyncStore((state) => state.fileCloneLog);
  const fileCloneRunning = useSyncStore((state) => state.fileCloneRunning);
  const fileClonePollIntervalSeconds = useSyncStore((state) => state.fileClonePollIntervalSeconds);

  const autoPinWidget = useSyncStore((state) => state.autoPinWidget);

  const addOrUpdateTeamSpaceMapping = useSyncStore((state) => state.addOrUpdateTeamSpaceMapping);
  const setAutoPinWidget = useSyncStore((state) => state.setAutoPinWidget);

  const removeFileCloneMapping = useSyncStore((state) => state.removeFileCloneMapping);
  const updateFileCloneMapping = useSyncStore((state) => state.updateFileCloneMapping);
  const setFileCloneMappings = useSyncStore((state) => state.setFileCloneMappings);
  const setFileClonePollInterval = useSyncStore((state) => state.setFileClonePollInterval);
  const clearFileCloneLog = useSyncStore((state) => state.clearFileCloneLog);

  const { matrixStatus, matrixUserId } = useTokenContext();
  const {
    canRun: canRunFileClone,
    startCloneSync,
    stopCloneSync,
    runInitialClone,
  } = useFileCloneEngine();

  const lastFileCloneRunAt = useMemo(() => fileCloneLog[0]?.timestamp ?? null, [fileCloneLog]);

  function handleTeamSpaceResolved(mapping: TeamSpaceMapping): void {
    addOrUpdateTeamSpaceMapping(mapping);
  }

  function handleFileCloneMappingsCreated(nextMappings: FileCloneMapping[]): void {
    const byId = new Map<string, FileCloneMapping>();

    for (const mapping of fileCloneMappings) {
      byId.set(mapping.id, mapping);
    }

    for (const mapping of nextMappings) {
      byId.set(mapping.id, mapping);
    }

    setFileCloneMappings([...byId.values()]);
  }

  return (
    <div className="space-y-4 p-4">
      <section className="rounded-lg border border-border-default bg-app-surface p-4">
        <h2 className="text-base font-semibold text-text-primary">Teams to Element File Clone</h2>
        <p className="mt-1 text-xs text-text-secondary">
          File clone runs only while this Sync tab is active. Switching to Files pauses syncing to preserve UI performance.
        </p>
        <p className="mt-2 text-xs text-text-tertiary">
          Matrix:{" "}
          {matrixStatus === "valid"
            ? matrixUserId
              ? `connected as ${matrixUserId}`
              : "token connected (whoami pending)"
            : "not connected"}
        </p>
      </section>

      <FileCloneControls
        canRun={canRunFileClone}
        running={fileCloneRunning}
        pollIntervalSeconds={fileClonePollIntervalSeconds}
        onPollIntervalChange={setFileClonePollInterval}
        onStart={startCloneSync}
        onStop={stopCloneSync}
        lastRunAt={lastFileCloneRunAt}
      />

      <QuickSetup
        autoPinWidget={autoPinWidget}
        onAutoPinWidgetChange={setAutoPinWidget}
        onTeamSpaceResolved={handleTeamSpaceResolved}
        onMappingsCreated={handleFileCloneMappingsCreated}
        onRunInitialClone={runInitialClone}
        onStartCloneSync={startCloneSync}
      />

      <FileCloneMappings
        mappings={fileCloneMappings}
        errors={fileCloneErrors}
        onToggleEnabled={(mapping, enabled) => {
          updateFileCloneMapping(mapping.id, { enabled });
        }}
        onRemove={(mapping) => {
          removeFileCloneMapping(mapping.id);
        }}
      />

      <SyncLog
        messageEntries={[]}
        fileEntries={fileCloneLog}
        onClear={(kind) => {
          if (kind === "files") {
            clearFileCloneLog();
          }
        }}
      />
    </div>
  );
}
