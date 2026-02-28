import { useEffect, useRef } from "react";
import { useTokenContext } from "@/auth/TokenContext";
import { useSyncStore } from "@/stores/sync-store";
import { syncEngine } from "@/sync/sync-engine";

export function useSyncEngine() {
  const activeTab = useSyncStore((state) => state.activeTab);
  const syncRunning = useSyncStore((state) => state.syncRunning);
  const pollIntervalSeconds = useSyncStore((state) => state.pollIntervalSeconds);
  const setSyncRunning = useSyncStore((state) => state.setSyncRunning);

  const { token, matrixToken } = useTokenContext();
  const lastIntervalRef = useRef<number>(pollIntervalSeconds);

  const canRun = Boolean(token && matrixToken);

  useEffect(() => {
    if (!syncRunning || activeTab !== "sync" || !canRun) {
      syncEngine.stop();
      return;
    }

    if (!syncEngine.isActive()) {
      syncEngine.start();
      lastIntervalRef.current = pollIntervalSeconds;
      return;
    }

    if (lastIntervalRef.current !== pollIntervalSeconds) {
      syncEngine.restart();
      lastIntervalRef.current = pollIntervalSeconds;
    }
  }, [activeTab, canRun, pollIntervalSeconds, syncRunning]);

  useEffect(() => {
    if (!canRun && syncRunning) {
      setSyncRunning(false);
      syncEngine.stop();
    }
  }, [canRun, setSyncRunning, syncRunning]);

  useEffect(() => {
    return () => {
      syncEngine.stop();
    };
  }, []);

  function startSync(): void {
    if (!canRun) {
      return;
    }

    setSyncRunning(true);
  }

  function stopSync(): void {
    setSyncRunning(false);
    syncEngine.stop();
  }

  return {
    canRun,
    startSync,
    stopSync,
    isEngineActive: syncEngine.isActive(),
  };
}
