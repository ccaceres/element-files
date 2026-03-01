const MAX_RETRY_DELAY_MS = 60_000;

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const asSeconds = Number.parseFloat(trimmed);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.round(asSeconds * 1000);
  }

  const asDate = Date.parse(trimmed);
  if (Number.isNaN(asDate)) {
    return null;
  }

  const delta = asDate - Date.now();
  return delta > 0 ? delta : 0;
}

function computeBackoffWithJitter(
  attempt: number,
  baseMs = 1000,
  capMs = MAX_RETRY_DELAY_MS,
): number {
  const safeAttempt = Math.max(0, attempt);
  const exponential = Math.min(baseMs * 2 ** safeAttempt, capMs);
  const jitterFactor = 0.85 + Math.random() * 0.3;
  return Math.max(250, Math.min(capMs, Math.round(exponential * jitterFactor)));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export { MAX_RETRY_DELAY_MS, computeBackoffWithJitter, parseRetryAfterMs, sleep };
