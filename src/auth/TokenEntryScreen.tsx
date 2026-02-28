import { useState, type FormEvent } from "react";
import { useTokenContext } from "@/auth/TokenContext";
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
  const { setToken, status, clearExpiredState } = useTokenContext();
  const [token, setTokenValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOverlay = mode === "overlay";
  const showExpiredCopy = forceExpired || status === "expired";

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const valid = await setToken(token);
      if (!valid) {
        setError("Invalid token. Please copy a fresh access token from Graph Explorer.");
        return;
      }

      clearExpiredState();
      setTokenValue("");
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
      <div className="w-full max-w-2xl rounded-lg border border-border-default bg-app-surface p-6 shadow-panel">
        <div className="mb-5 flex items-center gap-3 text-text-primary">
          <div className="rounded-md bg-accent-light p-2 text-accent-primary">
            <KeyRegular fontSize={22} />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Connect to Microsoft 365</h1>
            <p className="text-sm text-text-secondary">
              {showExpiredCopy
                ? "Token expired. Paste a new access token to continue browsing files."
                : "Paste a Microsoft Graph access token to open Teams files."}
            </p>
          </div>
        </div>

        <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm text-text-secondary">
          <li>
            Open
            <a
              className="ml-1 text-text-link hover:underline"
              href="https://developer.microsoft.com/en-us/graph/graph-explorer"
              target="_blank"
              rel="noreferrer"
            >
              Graph Explorer
            </a>
            .
          </li>
          <li>Sign in with your ICC account.</li>
          <li>Open the Access token tab and copy the full token.</li>
        </ol>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-text-primary" htmlFor="token-input">
            Bearer Token
          </label>
          <textarea
            id="token-input"
            className="h-36 w-full rounded border border-border-default bg-app-content p-3 font-mono text-xs text-text-primary outline-none transition focus:border-accent-primary"
            placeholder="Paste your bearer token here..."
            value={token}
            onChange={(event) => setTokenValue(event.target.value)}
            disabled={submitting}
          />

          {error ? <p className="text-sm text-token-expired">{error}</p> : null}

          <div className="flex items-center gap-3">
            <button
              className="rounded bg-accent-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
              type="submit"
              disabled={submitting || token.trim().length === 0}
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
          Token is stored in your browser session only and never sent to our servers.
        </p>
      </div>
    </div>
  );
}

