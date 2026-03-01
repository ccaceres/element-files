import { useMemo, useState, type FormEvent } from "react";
import { validateToken } from "@/api/teams";
import { useTokenContext } from "@/auth/TokenContext";
import { normalizeAccessToken } from "@/auth/token-format";
import {
  getConfiguredMatrixHomeserver,
  getConfiguredMatrixToken,
} from "@/auth/token-manager";
import { KeyRegular } from "@fluentui/react-icons";
import clsx from "clsx";

interface TokenEntryScreenProps {
  mode?: "fullscreen" | "overlay";
  onSuccess?: () => void;
  onCancel?: () => void;
  forceExpired?: boolean;
}

export function TokenEntryScreen({
  mode = "fullscreen",
  onSuccess,
  onCancel,
  forceExpired = false,
}: TokenEntryScreenProps) {
  const { setToken, setMatrixToken, status, clearExpiredState, matrixHomeserver } =
    useTokenContext();
  const envMatrixToken = getConfiguredMatrixToken();
  const envMatrixHomeserver = getConfiguredMatrixHomeserver();
  const matrixTokenFromEnv = Boolean(envMatrixToken);

  const [graphToken, setGraphToken] = useState("");
  const [matrixToken, setMatrixTokenValue] = useState("");
  const [homeserver, setHomeserver] = useState(envMatrixHomeserver || matrixHomeserver);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matrixWarning, setMatrixWarning] = useState<string | null>(null);

  const isOverlay = mode === "overlay";
  const showExpiredCopy = forceExpired || status === "expired";

  const canSubmit = useMemo(
    () => graphToken.trim().length > 0 && !submitting,
    [graphToken, submitting],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMatrixWarning(null);

    try {
      const graphOk = await setToken(graphToken);
      if (!graphOk) {
        const normalizedGraphToken = normalizeAccessToken(graphToken);
        const validation = await validateToken(normalizedGraphToken);

        if (validation.status === 401) {
          setError(
            `Graph /me returned 401 Unauthorized. The token may be expired, revoked, or for a different audience. ${validation.message ?? ""}`.trim(),
          );
          return;
        }

        if (validation.status === 403) {
          setError(
            `Graph /me returned 403 Forbidden. This token is not allowed to read profile data in this tenant (User.Read delegated scope and tenant policy must allow it). ${validation.message ?? ""}`.trim(),
          );
          return;
        }

        if (validation.status) {
          setError(
            `Graph /me returned ${validation.status}. ${validation.message ?? "Token validation failed."}`.trim(),
          );
          return;
        }

        setError(
          `Could not validate Microsoft token against Graph /me. ${validation.message ?? "Check network, browser privacy settings, and try again."}`.trim(),
        );
        return;
      }

      const matrixTokenTrimmed = matrixTokenFromEnv ? envMatrixToken ?? "" : matrixToken.trim();
      if (matrixTokenTrimmed) {
        const matrixOk = await setMatrixToken(matrixTokenTrimmed, homeserver.trim());
        if (!matrixOk) {
          setError(
            matrixTokenFromEnv
              ? "Graph token is valid, but environment Matrix token validation failed."
              : "Graph token is valid, but Matrix token is invalid. Check token and homeserver.",
          );
          return;
        }
      } else {
        setMatrixWarning("Connected for Files. Add Matrix token later to enable Sync.");
      }

      clearExpiredState();
      setGraphToken("");
      setMatrixTokenValue("");
      onSuccess?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={clsx(
        "w-full",
        isOverlay
          ? "absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
          : "flex min-h-screen items-center justify-center bg-app-bg p-4",
      )}
    >
      <div className="w-full max-w-3xl rounded-lg border border-border-default bg-app-surface p-6 shadow-panel">
        <div className="mb-5 flex items-center gap-3 text-text-primary">
          <div className="rounded-md bg-accent-light p-2 text-accent-primary">
            <KeyRegular fontSize={22} />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Connect to ICC-LAB Services</h1>
            <p className="text-sm text-text-secondary">
              {showExpiredCopy
                ? "Graph token expired. Paste a new token to continue."
                : "Files need Microsoft token. Sync needs both Microsoft and Element tokens."}
            </p>
          </div>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <section className="space-y-2">
            <label className="block text-sm font-medium text-text-primary" htmlFor="graph-token-input">
              Microsoft 365 Token (required)
            </label>
            <textarea
              id="graph-token-input"
              className="h-32 w-full rounded border border-border-default bg-app-content p-3 font-mono text-xs text-text-primary outline-none transition focus:border-accent-primary"
              placeholder="Paste Graph Explorer token..."
              value={graphToken}
              onChange={(event) => setGraphToken(event.target.value)}
              disabled={submitting}
            />
            <p className="text-xs text-text-secondary">
              Get it from
              <a
                className="ml-1 text-text-link hover:underline"
                href="https://developer.microsoft.com/en-us/graph/graph-explorer"
                target="_blank"
                rel="noreferrer"
              >
                Graph Explorer
              </a>
              .
            </p>
          </section>

          <section className="space-y-2">
            <label className="block text-sm font-medium text-text-primary" htmlFor="matrix-token-input">
              Element Token (required for Sync)
            </label>
            {matrixTokenFromEnv ? (
              <div className="rounded border border-border-default bg-app-content p-3 text-xs text-text-secondary">
                Matrix token is loaded from <code className="font-mono">ELEMENT_TOKEN</code> environment variable.
              </div>
            ) : (
              <textarea
                id="matrix-token-input"
                className="h-24 w-full rounded border border-border-default bg-app-content p-3 font-mono text-xs text-text-primary outline-none transition focus:border-accent-primary"
                placeholder="Paste Matrix access token..."
                value={matrixToken}
                onChange={(event) => setMatrixTokenValue(event.target.value)}
                disabled={submitting}
              />
            )}

            <label className="block text-xs font-medium text-text-secondary" htmlFor="matrix-homeserver-input">
              Matrix Homeserver
            </label>
            <input
              id="matrix-homeserver-input"
              className="w-full rounded border border-border-default bg-app-content px-3 py-2 text-xs text-text-primary outline-none transition focus:border-accent-primary"
              value={homeserver}
              onChange={(event) => setHomeserver(event.target.value)}
              placeholder="https://matrix.bsdu.eu"
              disabled={submitting || matrixTokenFromEnv}
            />
            <p className="text-xs text-text-secondary">
              Get token from Element: Settings - Help & About - Access Token.
            </p>
          </section>

          {error ? <p className="text-sm text-token-expired">{error}</p> : null}
          {matrixWarning ? <p className="text-sm text-token-warning">{matrixWarning}</p> : null}

          <div className="flex items-center gap-3">
            <button
              className="rounded bg-accent-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
              type="submit"
              disabled={!canSubmit}
            >
              {submitting ? "Connecting..." : "Connect"}
            </button>
            {onCancel ? (
              <button
                className="rounded border border-border-default px-4 py-2 text-sm text-text-secondary transition hover:bg-app-hover"
                type="button"
                onClick={onCancel}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <p className="mt-5 text-xs text-text-tertiary">
          Tokens are stored in your browser session only and never sent to our servers.
        </p>
      </div>
    </div>
  );
}
