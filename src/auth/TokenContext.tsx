import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { validateToken } from "@/api/teams";
import { tokenManager, type TokenClearReason } from "@/auth/token-manager";
import type { GraphUser, TokenState, TokenStatus } from "@/types";

interface TokenContextValue extends TokenState {
  initializing: boolean;
  wasAuthenticated: boolean;
  clearExpiredState: () => void;
}

const TokenContext = createContext<TokenContextValue | null>(null);

function getCurrentStatus(token: string | null): TokenStatus {
  if (!token) {
    return "none";
  }

  return tokenManager.isLikelyExpired() ? "expiring" : "valid";
}

export function TokenProvider({ children }: PropsWithChildren) {
  const [token, setTokenValue] = useState<string | null>(() => tokenManager.getToken());
  const [user, setUser] = useState<GraphUser | null>(null);
  const [status, setStatus] = useState<TokenStatus>(() => getCurrentStatus(tokenManager.getToken()));
  const [initializing, setInitializing] = useState(true);
  const [wasAuthenticated, setWasAuthenticated] = useState(false);

  const applyClearReason = useCallback((reason: TokenClearReason) => {
    setTokenValue(null);

    if (reason === "expired") {
      setStatus("expired");
      return;
    }

    setStatus("none");
    setUser(null);
    setWasAuthenticated(false);
  }, []);

  const setToken = useCallback(async (nextToken: string): Promise<boolean> => {
    const trimmed = nextToken.trim();
    if (!trimmed) {
      return false;
    }

    const result = await validateToken(trimmed);
    if (!result.valid || !result.user) {
      return false;
    }

    tokenManager.setToken(trimmed);
    setTokenValue(trimmed);
    setUser(result.user);
    setStatus(getCurrentStatus(trimmed));
    setWasAuthenticated(true);
    return true;
  }, []);

  const clearToken = useCallback(() => {
    tokenManager.clearToken("manual");
    applyClearReason("manual");
  }, [applyClearReason]);

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
      setStatus(getCurrentStatus(activeToken));
      setWasAuthenticated(true);
      return;
    }

    tokenManager.clearToken("expired");
    applyClearReason("expired");
  }, [applyClearReason, status]);

  const clearExpiredState = useCallback(() => {
    if (status === "expired") {
      setStatus("none");
    }
  }, [status]);

  useEffect(() => {
    let mounted = true;

    async function boot(): Promise<void> {
      const activeToken = tokenManager.getToken();
      if (!activeToken) {
        if (mounted) {
          setInitializing(false);
          setStatus("none");
        }
        return;
      }

      const result = await validateToken(activeToken);
      if (!mounted) {
        return;
      }

      if (result.valid && result.user) {
        setTokenValue(activeToken);
        setUser(result.user);
        setStatus(getCurrentStatus(activeToken));
        setWasAuthenticated(true);
      } else {
        tokenManager.clearToken("expired");
        applyClearReason("expired");
      }

      setInitializing(false);
    }

    boot();

    return () => {
      mounted = false;
    };
  }, [applyClearReason]);

  useEffect(() => {
    const unsubscribe = tokenManager.subscribe((event) => {
      if (event.type === "set") {
        setTokenValue(event.token);
        setStatus(getCurrentStatus(event.token));
        return;
      }

      applyClearReason(event.reason);
    });

    return unsubscribe;
  }, [applyClearReason]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (tokenManager.getToken()) {
        setStatus(getCurrentStatus(tokenManager.getToken()));
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
      setToken,
      clearToken,
      revalidateToken,
      initializing,
      wasAuthenticated,
      clearExpiredState,
    }),
    [
      clearExpiredState,
      clearToken,
      initializing,
      revalidateToken,
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

