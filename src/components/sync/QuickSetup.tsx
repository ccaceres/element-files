import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { resolveCloneRoots } from "@/api/teams";
import { useTokenContext } from "@/auth/TokenContext";
import { matrixTokenManager } from "@/auth/token-manager";
import { useNavigation } from "@/hooks/useNavigation";
import { useTeams } from "@/hooks/useTeams";
import { useSyncStore } from "@/stores/sync-store";
import { setupFileCloneRooms } from "@/sync/room-setup";
import type { FileCloneMapping, TeamSpaceMapping } from "@/types";

interface QuickSetupProps {
  autoPinWidget: boolean;
  onAutoPinWidgetChange: (pin: boolean) => void;
  onTeamSpaceResolved: (mapping: TeamSpaceMapping) => void;
  onMappingsCreated: (mappings: FileCloneMapping[]) => void;
  onRunInitialClone: (mappings: FileCloneMapping[]) => Promise<void>;
  onStartCloneSync: () => void;
}

export function QuickSetup({
  autoPinWidget,
  onAutoPinWidgetChange,
  onTeamSpaceResolved,
  onMappingsCreated,
  onRunInitialClone,
  onStartCloneSync,
}: QuickSetupProps) {
  const teamsQuery = useTeams();
  const { selectedTeam: sidebarTeam } = useNavigation();
  const { matrixToken, matrixUserId } = useTokenContext();
  const latestMappings = useSyncStore((state) => state.fileCloneMappings);
  const teamSpaceMappings = useSyncStore((state) => state.teamSpaceMappings);

  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sidebarTeam?.id) {
      setSelectedTeamId(sidebarTeam.id);
    }
  }, [sidebarTeam?.id]);

  useEffect(() => {
    if (!selectedTeamId && teamsQuery.data && teamsQuery.data.length > 0) {
      setSelectedTeamId(teamsQuery.data[0]?.id ?? "");
    }
  }, [selectedTeamId, teamsQuery.data]);

  const selectedTeam = useMemo(
    () => (teamsQuery.data ?? []).find((team) => team.id === selectedTeamId) ?? null,
    [selectedTeamId, teamsQuery.data],
  );

  const cloneRootsQuery = useQuery({
    queryKey: ["clone-roots", selectedTeamId],
    queryFn: () => resolveCloneRoots(selectedTeamId),
    enabled: Boolean(selectedTeamId),
    staleTime: 60 * 1000,
  });

  const cloneRoots = cloneRootsQuery.data ?? [];
  const teamsChannelCount = cloneRoots.filter((root) => root.source === "teams-channel").length;
  const driveFolderCount = cloneRoots.filter((root) => root.source === "drive-folder").length;
  const effectiveMatrixToken = matrixToken ?? matrixTokenManager.getToken();
  const hasMatrixToken = Boolean(effectiveMatrixToken);

  const capabilityNote = useMemo(() => {
    if (!selectedTeam) {
      return null;
    }

    if (cloneRoots.length === 0 && !cloneRootsQuery.isLoading) {
      return "No accessible file roots found for this team.";
    }

    if (teamsChannelCount === 0 && driveFolderCount > 0) {
      return "Message sync unavailable for this team (channel API blocked). File clone is available via SharePoint folder mode.";
    }

    return null;
  }, [cloneRoots.length, cloneRootsQuery.isLoading, driveFolderCount, selectedTeam, teamsChannelCount]);

  async function prepareMappings(): Promise<{
    teamSpaceMapping: TeamSpaceMapping;
    mappings: FileCloneMapping[];
  }> {
    if (!selectedTeam) {
      throw new Error("Select a team before starting file clone.");
    }

    if (!hasMatrixToken) {
      throw new Error("Matrix token is required for file clone.");
    }

    if (cloneRoots.length === 0) {
      throw new Error("No clone roots found for the selected team.");
    }

    const effectivePinWidget = autoPinWidget && Boolean(matrixUserId);

    return setupFileCloneRooms(
      selectedTeam.id,
      selectedTeam.displayName,
      cloneRoots,
      latestMappings,
      teamSpaceMappings,
      {
        pinWidget: effectivePinWidget,
        widgetUrl: window.location.origin,
        matrixUserId: matrixUserId ?? undefined,
        widgetName: "ICC-LAB Files",
      },
    );
  }

  async function handleCloneNow(): Promise<void> {
    setRunning(true);
    setError(null);

    try {
      const result = await prepareMappings();
      onTeamSpaceResolved(result.teamSpaceMapping);
      onMappingsCreated(result.mappings);
      const enabledMappings = result.mappings.filter((mapping) => mapping.enabled);
      await onRunInitialClone(enabledMappings);
      onStartCloneSync();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "File clone setup failed.");
    } finally {
      setRunning(false);
    }
  }

  async function handlePrepareOnly(): Promise<void> {
    setRunning(true);
    setError(null);

    try {
      const result = await prepareMappings();
      onTeamSpaceResolved(result.teamSpaceMapping);
      onMappingsCreated(result.mappings);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not prepare clone mappings.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="rounded-lg border border-border-default bg-app-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">Quick Setup</h3>

      <div className="rounded border border-border-default bg-app-content p-3">
        <p className="text-sm font-semibold text-text-primary">One-click file clone</p>
        <p className="mt-1 text-xs text-text-secondary">
          Selected team: <span className="text-text-primary">{selectedTeam?.displayName ?? "None selected"}</span>
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          Discoverable roots: {cloneRoots.length} ({teamsChannelCount} Teams channels, {driveFolderCount} folder fallback)
        </p>
        <p className="mt-1 text-xs text-text-tertiary">
          Creates one Team Space with channel rooms, clones full folder structure, then starts delta sync.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded bg-accent-primary px-3 py-1.5 text-sm text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
            disabled={running || !selectedTeam || !hasMatrixToken || cloneRootsQuery.isLoading}
            onClick={() => {
              void handleCloneNow();
            }}
          >
            {running ? "Cloning..." : "Clone selected team files now"}
          </button>

          <button
            type="button"
            className="rounded border border-border-default px-3 py-1.5 text-sm text-text-secondary transition hover:bg-app-hover"
            onClick={() => setShowAdvanced((state) => !state)}
          >
            {showAdvanced ? "Hide advanced options" : "Show advanced options"}
          </button>
        </div>
      </div>

      {showAdvanced ? (
        <div className="mt-3 rounded border border-border-default bg-app-content p-3">
          <p className="mb-3 text-sm font-semibold text-text-primary">Advanced options</p>

          <div>
            <label className="mb-1 block text-xs text-text-secondary" htmlFor="quick-setup-team">
              Team
            </label>
            <select
              id="quick-setup-team"
              className="w-full rounded border border-border-default bg-app-surface px-2 py-2 text-sm text-text-primary outline-none"
              value={selectedTeamId}
              onChange={(event) => setSelectedTeamId(event.target.value)}
            >
              {(teamsQuery.data ?? []).map((team) => (
                <option key={team.id} value={team.id}>
                  {team.displayName}
                </option>
              ))}
            </select>
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={autoPinWidget}
              onChange={(event) => onAutoPinWidgetChange(event.target.checked)}
            />
            Pin file widget to each new room
          </label>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded border border-border-default px-3 py-1.5 text-sm text-text-secondary transition hover:bg-app-hover disabled:cursor-not-allowed disabled:opacity-70"
              disabled={running}
              onClick={() => {
                void handlePrepareOnly();
              }}
            >
              {running ? "Preparing..." : "Prepare mappings only"}
            </button>
          </div>
        </div>
      ) : null}

      {capabilityNote ? <p className="mt-2 text-xs text-token-warning">{capabilityNote}</p> : null}
      {cloneRootsQuery.error ? (
        <p className="mt-2 text-xs text-token-expired">
          Could not discover clone roots for this team.
        </p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-token-expired">{error}</p> : null}
      {autoPinWidget && hasMatrixToken && !matrixUserId ? (
        <p className="mt-2 text-xs text-token-warning">
          Matrix token is set but user identity could not be resolved yet. Clone will run, but widget auto-pin is skipped.
        </p>
      ) : null}
      <p className="mt-2 text-xs text-text-tertiary">
        Only mappings marked as Enabled are cloned. Paused mappings are skipped.
      </p>
      {sidebarTeam ? (
        <p className="mt-2 text-xs text-text-tertiary">
          Tip: choose a different team in the sidebar, then click clone.
        </p>
      ) : null}
    </section>
  );
}
