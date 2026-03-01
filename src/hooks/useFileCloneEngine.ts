import { useEffect, useRef } from "react";
import { useTokenContext } from "@/auth/TokenContext";
import { matrixTokenManager } from "@/auth/token-manager";
import { useSyncStore } from "@/stores/sync-store";
import { fileCloneEngine } from "@/sync/file-clone-engine";
import type { FileCloneMapping } from "@/types";

export function useFileCloneEngine() {
  const activeTab = useSyncStore((state) => state.activeTab);
  const fileCloneRunning = useSyncStore((state) => state.fileCloneRunning);
  const fileClonePollIntervalSeconds = useSyncStore((state) => state.fileClonePollIntervalSeconds);
  const setFileCloneRunning = useSyncStore((state) => state.setFileCloneRunning);

  const { token, matrixToken } = useTokenContext();
  const lastIntervalRef = useRef<number>(fileClonePollIntervalSeconds);
  const effectiveMatrixToken = matrixToken ?? matrixTokenManager.getToken();

  const canRun = Boolean(token && effectiveMatrixToken);

  useEffect(() => {
    if (!fileCloneRunning || activeTab !== "sync" || !canRun) {
      fileCloneEngine.stop();
      return;
    }

    if (!fileCloneEngine.isActive()) {
      fileCloneEngine.start();
      lastIntervalRef.current = fileClonePollIntervalSeconds;
      return;
    }

    if (lastIntervalRef.current !== fileClonePollIntervalSeconds) {
      fileCloneEngine.restart();
      lastIntervalRef.current = fileClonePollIntervalSeconds;
    }
  }, [activeTab, canRun, fileClonePollIntervalSeconds, fileCloneRunning]);

  useEffect(() => {
    if (!canRun && fileCloneRunning) {
      setFileCloneRunning(false);
      fileCloneEngine.stop();
    }
  }, [canRun, fileCloneRunning, setFileCloneRunning]);

  useEffect(() => {
    return () => {
      fileCloneEngine.stop();
    };
  }, []);

  function startCloneSync(): void {
    if (!canRun) {
      return;
    }
    setFileCloneRunning(true);
  }

  function stopCloneSync(): void {
    setFileCloneRunning(false);
    fileCloneEngine.stop();
  }

  async function runInitialClone(mappings: FileCloneMapping[]): Promise<void> {
    for (const mapping of mappings) {
      await fileCloneEngine.runInitialClone(mapping);
    }
  }

  return {
    canRun,
    startCloneSync,
    stopCloneSync,
    runInitialClone,
    isEngineActive: fileCloneEngine.isActive(),
  };
}
