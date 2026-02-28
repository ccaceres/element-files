const TOKEN_KEY = "graph_bearer_token";
const TOKEN_TIMESTAMP_KEY = "graph_token_timestamp";
const MATRIX_TOKEN_KEY = "matrix_access_token";
const MATRIX_HOMESERVER_KEY = "matrix_homeserver_url";
const MATRIX_DEFAULT_HOMESERVER = "https://matrix.bsdu.eu";

type TokenClearReason = "manual" | "expired";

type TokenEvent =
  | { type: "set"; token: string }
  | { type: "clear"; reason: TokenClearReason };

type TokenListener = (event: TokenEvent) => void;
type MatrixTokenEvent = { type: "set"; token: string } | { type: "clear" };
type MatrixTokenListener = (event: MatrixTokenEvent) => void;

const listeners = new Set<TokenListener>();
const matrixListeners = new Set<MatrixTokenListener>();

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

function emitMatrix(event: MatrixTokenEvent): void {
  for (const listener of matrixListeners) {
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

export const matrixTokenManager = {
  getToken: (): string | null => {
    const storage = getSessionStorage();
    return storage?.getItem(MATRIX_TOKEN_KEY) ?? null;
  },

  setToken: (token: string): void => {
    const storage = getSessionStorage();
    if (!storage) {
      return;
    }

    storage.setItem(MATRIX_TOKEN_KEY, token);
    emitMatrix({ type: "set", token });
  },

  clearToken: (): void => {
    const storage = getSessionStorage();
    if (!storage) {
      return;
    }

    storage.removeItem(MATRIX_TOKEN_KEY);
    emitMatrix({ type: "clear" });
  },

  getHomeserver: (): string => {
    const storage = getSessionStorage();
    const stored = storage?.getItem(MATRIX_HOMESERVER_KEY);
    return stored || MATRIX_DEFAULT_HOMESERVER;
  },

  setHomeserver: (url: string): void => {
    const storage = getSessionStorage();
    if (!storage) {
      return;
    }

    storage.setItem(MATRIX_HOMESERVER_KEY, url);
  },

  subscribe: (listener: MatrixTokenListener): (() => void) => {
    matrixListeners.add(listener);
    return () => {
      matrixListeners.delete(listener);
    };
  },
};

export {
  TOKEN_KEY,
  TOKEN_TIMESTAMP_KEY,
  MATRIX_TOKEN_KEY,
  MATRIX_HOMESERVER_KEY,
  MATRIX_DEFAULT_HOMESERVER,
};
export type { TokenClearReason, TokenEvent, MatrixTokenEvent };
