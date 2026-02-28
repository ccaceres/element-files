interface SyncControlsProps {
  canRun: boolean;
  syncRunning: boolean;
  pollIntervalSeconds: number;
  onPollIntervalChange: (seconds: number) => void;
  onStart: () => void;
  onStop: () => void;
  lastRunAt?: string | null;
}

export function SyncControls({
  canRun,
  syncRunning,
  pollIntervalSeconds,
  onPollIntervalChange,
  onStart,
  onStop,
  lastRunAt,
}: SyncControlsProps) {
  return (
    <section className="rounded-lg border border-border-default bg-app-surface p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded bg-accent-primary px-3 py-1.5 text-sm text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
          disabled={!canRun || syncRunning}
          onClick={onStart}
        >
          Start Sync
        </button>
        <button
          type="button"
          className="rounded border border-border-default px-3 py-1.5 text-sm text-text-secondary transition hover:bg-app-hover disabled:cursor-not-allowed disabled:opacity-70"
          disabled={!syncRunning}
          onClick={onStop}
        >
          Pause
        </button>

        <label className="ml-2 text-xs text-text-secondary" htmlFor="sync-poll-interval">
          Poll every
        </label>
        <select
          id="sync-poll-interval"
          className="rounded border border-border-default bg-app-content px-2 py-1 text-xs text-text-primary outline-none"
          value={pollIntervalSeconds}
          onChange={(event) => onPollIntervalChange(Number.parseInt(event.target.value, 10))}
        >
          <option value={10}>10s</option>
          <option value={15}>15s</option>
          <option value={30}>30s</option>
          <option value={60}>60s</option>
          <option value={120}>120s</option>
        </select>

        <span className="text-xs text-text-secondary">status: {syncRunning ? "syncing" : "paused"}</span>
      </div>

      <p className="text-xs text-text-tertiary">
        {lastRunAt ? `Last run: ${new Date(lastRunAt).toLocaleTimeString()}` : "No sync run yet."}
      </p>
      {!canRun ? (
        <p className="mt-2 text-xs text-token-warning">
          Matrix token is required for Sync. Add it from the token modal.
        </p>
      ) : null}
    </section>
  );
}
