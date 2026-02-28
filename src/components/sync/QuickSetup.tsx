import { useEffect, useMemo, useState } from "react";
import { useTokenContext } from "@/auth/TokenContext";
import { useChannels } from "@/hooks/useChannels";
import { useTeams } from "@/hooks/useTeams";
import { setupTeamRooms } from "@/sync/room-setup";
import type { ChannelMapping } from "@/types";

interface QuickSetupProps {
  autoPinWidget: boolean;
  onAutoPinWidgetChange: (pin: boolean) => void;
  onMappingsCreated: (mappings: ChannelMapping[]) => void;
  onStartSync: () => void;
}

export function QuickSetup({
  autoPinWidget,
  onAutoPinWidgetChange,
  onMappingsCreated,
  onStartSync,
}: QuickSetupProps) {
  const teamsQuery = useTeams();
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const channelsQuery = useChannels(selectedTeamId || null);
  const { matrixUserId } = useTokenContext();

  const [backfillCount, setBackfillCount] = useState(50);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (teamsQuery.data && teamsQuery.data.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teamsQuery.data[0]?.id ?? "");
    }
  }, [selectedTeamId, teamsQuery.data]);

  const selectedTeam = useMemo(
    () => (teamsQuery.data ?? []).find((team) => team.id === selectedTeamId) ?? null,
    [selectedTeamId, teamsQuery.data],
  );

  const channels = useMemo(
    () => (channelsQuery.data ?? []).filter((channel) => channel.source === "teams-channel"),
    [channelsQuery.data],
  );

  async function handleSetup(startSyncAfter: boolean): Promise<void> {
    if (!selectedTeam) {
      setError("Select a team for quick setup.");
      return;
    }

    if (!matrixUserId) {
      setError("Matrix token is required before quick setup.");
      return;
    }

    if (channels.length === 0) {
      setError("No sync-compatible channels found for this team.");
      return;
    }

    setRunning(true);
    setError(null);

    try {
      const mappings = await setupTeamRooms(selectedTeam.id, selectedTeam.displayName, channels, {
        pinWidget: autoPinWidget,
        widgetUrl: window.location.origin,
        matrixUserId,
        backfillCount,
      });

      onMappingsCreated(mappings);

      if (startSyncAfter) {
        onStartSync();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Quick setup failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="rounded-lg border border-border-default bg-app-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">Quick Setup</h3>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-text-secondary" htmlFor="quick-setup-team">
            Team
          </label>
          <select
            id="quick-setup-team"
            className="w-full rounded border border-border-default bg-app-content px-2 py-2 text-sm text-text-primary outline-none"
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

        <div>
          <label className="mb-1 block text-xs text-text-secondary" htmlFor="quick-setup-backfill">
            Backfill messages
          </label>
          <select
            id="quick-setup-backfill"
            className="w-full rounded border border-border-default bg-app-content px-2 py-2 text-sm text-text-primary outline-none"
            value={backfillCount}
            onChange={(event) => setBackfillCount(Number.parseInt(event.target.value, 10))}
          >
            <option value={0}>No history</option>
            <option value={20}>Last 20 messages</option>
            <option value={50}>Last 50 messages</option>
            <option value={100}>Last 100 messages</option>
          </select>
        </div>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-text-primary">
        <input
          type="checkbox"
          checked={autoPinWidget}
          onChange={(event) => onAutoPinWidgetChange(event.target.checked)}
        />
        Pin file widget to each new room
      </label>

      <p className="mt-2 text-xs text-text-secondary">
        Channels available for setup: {channels.length}
      </p>

      {error ? <p className="mt-2 text-xs text-token-expired">{error}</p> : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded border border-border-default px-3 py-1.5 text-sm text-text-secondary transition hover:bg-app-hover disabled:cursor-not-allowed disabled:opacity-70"
          disabled={running}
          onClick={() => {
            void handleSetup(false);
          }}
        >
          {running ? "Setting up..." : "Create rooms + mappings"}
        </button>

        <button
          type="button"
          className="rounded bg-accent-primary px-3 py-1.5 text-sm text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
          disabled={running}
          onClick={() => {
            void handleSetup(true);
          }}
        >
          {running ? "Setting up..." : "Create + start sync"}
        </button>
      </div>
    </section>
  );
}
