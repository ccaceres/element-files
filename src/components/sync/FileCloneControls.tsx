interface FileCloneControlsProps {
  canRun: boolean;
  running: boolean;
  pollIntervalSeconds: number;
  onPollIntervalChange: (seconds: number) => void;
  onStart: () => void;
  onStop: () => void;
  lastRunAt?: string | null;
}

export function FileCloneControls({
  canRun,
  running,
  pollIntervalSeconds,
  onPollIntervalChange,
  onStart,
  onStop,
  lastRunAt,
}: FileCloneControlsProps) {
  return (
    <section className="rounded-lg border border-border-default bg-app-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">File Clone Sync</h3>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded bg-accent-primary px-3 py-1.5 text-sm text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
          disabled={!canRun || running}
          onClick={onStart}
        >
          Start File Delta Sync
        </button>
        <button
          type="button"
          className="rounded border border-border-default px-3 py-1.5 text-sm text-text-secondary transition hover:bg-app-hover disabled:cursor-not-allowed disabled:opacity-70"
          disabled={!running}
          onClick={onStop}
        >
          Pause
        </button>

        <label className="ml-2 text-xs text-text-secondary" htmlFor="file-clone-poll-interval">
          Poll every
        </label>
        <select
          id="file-clone-poll-interval"
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

        <span className="text-xs text-text-secondary">status: {running ? "running" : "paused"}</span>
      </div>

      <p className="text-xs text-text-tertiary">
        {lastRunAt ? `Last file clone run: ${new Date(lastRunAt).toLocaleTimeString()}` : "No clone run yet."}
      </p>

      {!canRun ? (
        <p className="mt-2 text-xs text-token-warning">
          Graph and Matrix tokens are required for file clone sync.
        </p>
      ) : null}
    </section>
  );
}

