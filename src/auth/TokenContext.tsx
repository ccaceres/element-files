import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { validateMatrixToken } from "@/api/matrix-client";
import { validateToken } from "@/api/teams";
import { normalizeAccessToken } from "@/auth/token-format";
import {
  matrixTokenManager,
  tokenManager,
  type TokenClearReason,
} from "@/auth/token-manager";
import type {
  GraphUser,
  MatrixTokenStatus,
  TokenState,
  TokenStatus,
} from "@/types";

interface TokenContextValue extends TokenState {
  initializing: boolean;
  wasAuthenticated: boolean;
  clearExpiredState: () => void;
}

const TokenContext = createContext<TokenContextValue | null>(null);

function getGraphStatus(token: string | null): TokenStatus {
  if (!token) {
    return "none";
  }

  return tokenManager.isLikelyExpired() ? "expiring" : "valid";
}

function getMatrixStatus(token: string | null): MatrixTokenStatus {
  return token ? "valid" : "none";
}

export function TokenProvider({ children }: PropsWithChildren) {
  const [token, setTokenValue] = useState<string | null>(() => tokenManager.getToken());
  const [user, setUser] = useState<GraphUser | null>(null);
  const [status, setStatus] = useState<TokenStatus>(() => getGraphStatus(tokenManager.getToken()));

  const [matrixToken, setMatrixTokenValue] = useState<string | null>(() => matrixTokenManager.getToken());
  const [matrixUserId, setMatrixUserId] = useState<string | null>(null);
  const [matrixStatus, setMatrixStatus] = useState<MatrixTokenStatus>(() =>
    getMatrixStatus(matrixTokenManager.getToken()),
  );
  const [matrixHomeserver, setMatrixHomeserver] = useState<string>(() =>
    matrixTokenManager.getHomeserver(),
  );

  const [initializing, setInitializing] = useState(true);
  const [wasAuthenticated, setWasAuthenticated] = useState(false);

  const applyGraphClearReason = useCallback((reason: TokenClearReason) => {
    setTokenValue(null);

    if (reason === "expired") {
      setStatus("expired");
      return;
    }

    setStatus("none");
    setUser(null);
    setWasAuthenticated(false);
  }, []);

  const clearMatrixToken = useCallback(() => {
    matrixTokenManager.clearToken();
    const activeMatrixToken = matrixTokenManager.getToken();
    setMatrixTokenValue(activeMatrixToken);
    setMatrixUserId(null);
    setMatrixStatus(getMatrixStatus(activeMatrixToken));
  }, []);

  const setMatrixToken = useCallback(
    async (nextToken: string, homeserver?: string): Promise<boolean> => {
      const normalizedToken = normalizeAccessToken(nextToken);
      if (!normalizedToken) {
        return false;
      }

      const normalizedHomeserver = (homeserver ?? matrixHomeserver).trim() || matrixHomeserver;
      const validation = await validateMatrixToken(normalizedHomeserver, normalizedToken);
      if (!validation.valid && !validation.transient) {
        return false;
      }

      matrixTokenManager.setHomeserver(normalizedHomeserver);
      matrixTokenManager.setToken(normalizedToken);

      const effectiveHomeserver = matrixTokenManager.getHomeserver();
      const effectiveToken = matrixTokenManager.getToken();
      setMatrixHomeserver(effectiveHomeserver);
      setMatrixTokenValue(effectiveToken);
      setMatrixUserId(validation.valid ? validation.userId ?? null : null);
      setMatrixStatus("valid");
      return true;
    },
    [matrixHomeserver],
  );

  const setToken = useCallback(async (nextToken: string): Promise<boolean> => {
    const normalizedToken = normalizeAccessToken(nextToken);
    if (!normalizedToken) {
      return false;
    }

    const result = await validateToken(normalizedToken);
    if (!result.valid || !result.user) {
      return false;
    }

    tokenManager.setToken(normalizedToken);
    setTokenValue(normalizedToken);
    setUser(result.user);
    setStatus(getGraphStatus(normalizedToken));
    setWasAuthenticated(true);
    return true;
  }, []);

  const clearToken = useCallback(() => {
    tokenManager.clearToken("manual");
    applyGraphClearReason("manual");
    clearMatrixToken();
  }, [applyGraphClearReason, clearMatrixToken]);

  const revalidateToken = useCallback(async () => {
    const activeToken = tokenManager.getToken();
    if (!activeToken) {
      if (status !== "expired") {
        setStatus("none");
      }
      setTokenValue(null);
      setUser(null);
      return;
    }

    const result = await validateToken(activeToken);
    if (result.valid && result.user) {
      setTokenValue(activeToken);
      setUser(result.user);
      setStatus(getGraphStatus(activeToken));
      setWasAuthenticated(true);
      return;
    }

    tokenManager.clearToken("expired");
    applyGraphClearReason("expired");
  }, [applyGraphClearReason, status]);

  const clearExpiredState = useCallback(() => {
    if (status === "expired") {
      setStatus("none");
    }
  }, [status]);

  useEffect(() => {
    let mounted = true;

    async function boot(): Promise<void> {
      const storedGraphToken = tokenManager.getToken();
      const activeGraphToken = storedGraphToken ? normalizeAccessToken(storedGraphToken) : null;
      const storedMatrixToken = matrixTokenManager.getToken();
      const activeMatrixToken = storedMatrixToken ? normalizeAccessToken(storedMatrixToken) : null;
      const homeserver = matrixTokenManager.getHomeserver();

      setMatrixHomeserver(homeserver);

      if (activeGraphToken && storedGraphToken !== activeGraphToken) {
        tokenManager.setToken(activeGraphToken);
      }
      if (activeMatrixToken && storedMatrixToken !== activeMatrixToken) {
        matrixTokenManager.setToken(activeMatrixToken);
      }

      if (activeGraphToken) {
        const graphResult = await validateToken(activeGraphToken);

        if (!mounted) {
          return;
        }

        if (graphResult.valid && graphResult.user) {
          setTokenValue(activeGraphToken);
          setUser(graphResult.user);
          setStatus(getGraphStatus(activeGraphToken));
          setWasAuthenticated(true);
        } else {
          tokenManager.clearToken("expired");
          applyGraphClearReason("expired");
        }
      } else {
        setStatus("none");
      }

      if (activeMatrixToken) {
        const matrixResult = await validateMatrixToken(homeserver, activeMatrixToken);

        if (!mounted) {
          return;
        }

        if (matrixResult.valid && matrixResult.userId) {
          setMatrixTokenValue(activeMatrixToken);
          setMatrixUserId(matrixResult.userId);
          setMatrixStatus("valid");
        } else if (matrixResult.transient) {
          // Keep token on transient failures; operations can still revalidate lazily.
          setMatrixTokenValue(activeMatrixToken);
          setMatrixUserId(null);
          setMatrixStatus("valid");
        } else {
          clearMatrixToken();
        }
      } else {
        setMatrixStatus("none");
      }

      if (mounted) {
        setInitializing(false);
      }
    }

    void boot();

    return () => {
      mounted = false;
    };
  }, [applyGraphClearReason, clearMatrixToken]);

  useEffect(() => {
    const unsubscribe = tokenManager.subscribe((event) => {
      if (event.type === "set") {
        setTokenValue(event.token);
        setStatus(getGraphStatus(event.token));
        return;
      }

      applyGraphClearReason(event.reason);
    });

    return unsubscribe;
  }, [applyGraphClearReason]);

  useEffect(() => {
    const unsubscribe = matrixTokenManager.subscribe((event) => {
      if (event.type === "set") {
        setMatrixTokenValue(event.token);
        setMatrixStatus("valid");
        return;
      }

      setMatrixTokenValue(null);
      setMatrixUserId(null);
      setMatrixStatus("none");
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const activeToken = tokenManager.getToken();
      if (activeToken) {
        setStatus(getGraphStatus(activeToken));
      }
    }, 60 * 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const value = useMemo<TokenContextValue>(
    () => ({
      token,
      user,
      status,
      matrixToken,
      matrixUserId,
      matrixStatus,
      matrixHomeserver,
      setToken,
      clearToken,
      revalidateToken,
      setMatrixToken,
      clearMatrixToken,
      initializing,
      wasAuthenticated,
      clearExpiredState,
    }),
    [
      clearExpiredState,
      clearMatrixToken,
      clearToken,
      initializing,
      matrixHomeserver,
      matrixStatus,
      matrixToken,
      matrixUserId,
      revalidateToken,
      setMatrixToken,
      setToken,
      status,
      token,
      user,
      wasAuthenticated,
    ],
  );

  return <TokenContext.Provider value={value}>{children}</TokenContext.Provider>;
}

export function useTokenContext(): TokenContextValue {
  const context = useContext(TokenContext);
  if (!context) {
    throw new Error("useTokenContext must be used within TokenProvider");
  }

  return context;
}
