const TOKEN_KEY = "graph_bearer_token";
const TOKEN_TIMESTAMP_KEY = "graph_token_timestamp";

type TokenClearReason = "manual" | "expired";

type TokenEvent =
  | { type: "set"; token: string }
  | { type: "clear"; reason: TokenClearReason };

type TokenListener = (event: TokenEvent) => void;

const listeners = new Set<TokenListener>();

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function emit(event: TokenEvent): void {
  for (const listener of listeners) {
    listener(event);
  }
}

export const tokenManager = {
  getToken: (): string | null => {
    const storage = getSessionStorage();
    return storage?.getItem(TOKEN_KEY) ?? null;
  },

  setToken: (token: string): void => {
    const storage = getSessionStorage();
    if (!storage) {
      return;
    }

    storage.setItem(TOKEN_KEY, token);
    storage.setItem(TOKEN_TIMESTAMP_KEY, Date.now().toString());
    emit({ type: "set", token });
  },

  clearToken: (reason: TokenClearReason = "manual"): void => {
    const storage = getSessionStorage();
    if (!storage) {
      return;
    }

    storage.removeItem(TOKEN_KEY);
    storage.removeItem(TOKEN_TIMESTAMP_KEY);
    emit({ type: "clear", reason });
  },

  getTokenAge: (): number => {
    const storage = getSessionStorage();
    const ts = storage?.getItem(TOKEN_TIMESTAMP_KEY);
    if (!ts) {
      return Number.POSITIVE_INFINITY;
    }

    const parsed = Number.parseInt(ts, 10);
    if (Number.isNaN(parsed)) {
      return Number.POSITIVE_INFINITY;
    }

    return Date.now() - parsed;
  },

  isLikelyExpired: (): boolean => {
    return tokenManager.getTokenAge() > 55 * 60 * 1000;
  },

  subscribe: (listener: TokenListener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export { TOKEN_KEY, TOKEN_TIMESTAMP_KEY };
export type { TokenClearReason, TokenEvent };

