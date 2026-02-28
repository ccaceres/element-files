import { create } from "zustand";
import type { ChannelMapping, SyncLogEntry, SyncTab } from "@/types";

const MAPPINGS_KEY = "sync_channel_mappings";
const POLL_INTERVAL_KEY = "sync_poll_interval_seconds";
const AUTO_PIN_KEY = "sync_auto_pin_widget";

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

function loadMappings(): ChannelMapping[] {
  const storage = getSessionStorage();
  const stored = storage?.getItem(MAPPINGS_KEY);
  if (!stored) {
    return [];
  }

  try {
    return JSON.parse(stored) as ChannelMapping[];
  } catch {
    return [];
  }
}

function persistMappings(mappings: ChannelMapping[]): void {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  storage.setItem(MAPPINGS_KEY, JSON.stringify(mappings));
}

function loadPollInterval(): number {
  const storage = getSessionStorage();
  const stored = storage?.getItem(POLL_INTERVAL_KEY);
  const parsed = stored ? Number.parseInt(stored, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

function persistPollInterval(seconds: number): void {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  storage.setItem(POLL_INTERVAL_KEY, seconds.toString());
}

function loadAutoPinWidget(): boolean {
  const storage = getSessionStorage();
  const stored = storage?.getItem(AUTO_PIN_KEY);
  if (stored == null) {
    return true;
  }

  return stored === "true";
}

function persistAutoPinWidget(pin: boolean): void {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  storage.setItem(AUTO_PIN_KEY, String(pin));
}

interface SyncState {
  activeTab: SyncTab;
  setActiveTab: (tab: SyncTab) => void;

  mappings: ChannelMapping[];
  addMapping: (mapping: ChannelMapping) => void;
  removeMapping: (channelId: string) => void;
  updateMapping: (channelId: string, updates: Partial<ChannelMapping>) => void;
  setMappings: (mappings: ChannelMapping[]) => void;

  syncRunning: boolean;
  setSyncRunning: (running: boolean) => void;
  syncErrors: Record<string, string>;
  setSyncError: (channelId: string, error: string | null) => void;

  syncLog: SyncLogEntry[];
  addLogEntry: (entry: SyncLogEntry) => void;
  clearLog: () => void;

  pollIntervalSeconds: number;
  setPollInterval: (seconds: number) => void;

  autoPinWidget: boolean;
  setAutoPinWidget: (pin: boolean) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  activeTab: "files",
  setActiveTab: (activeTab) => set({ activeTab }),

  mappings: loadMappings(),
  addMapping: (mapping) =>
    set((state) => {
      const withoutOld = state.mappings.filter((entry) => entry.channelId !== mapping.channelId);
      const mappings = [...withoutOld, mapping];
      persistMappings(mappings);
      return { mappings };
    }),
  removeMapping: (channelId) =>
    set((state) => {
      const mappings = state.mappings.filter((entry) => entry.channelId !== channelId);
      persistMappings(mappings);
      return { mappings };
    }),
  updateMapping: (channelId, updates) =>
    set((state) => {
      const mappings = state.mappings.map((entry) =>
        entry.channelId === channelId ? { ...entry, ...updates } : entry,
      );
      persistMappings(mappings);
      return { mappings };
    }),
  setMappings: (mappings) => {
    persistMappings(mappings);
    set({ mappings });
  },

  syncRunning: false,
  setSyncRunning: (syncRunning) => set({ syncRunning }),

  syncErrors: {},
  setSyncError: (channelId, error) =>
    set((state) => {
      if (!error) {
        if (!state.syncErrors[channelId]) {
          return state;
        }

        const nextErrors = { ...state.syncErrors };
        delete nextErrors[channelId];
        return { syncErrors: nextErrors };
      }

      return {
        syncErrors: {
          ...state.syncErrors,
          [channelId]: error,
        },
      };
    }),

  syncLog: [],
  addLogEntry: (entry) =>
    set((state) => {
      const next = [entry, ...state.syncLog].slice(0, 100);
      return { syncLog: next };
    }),
  clearLog: () => set({ syncLog: [] }),

  pollIntervalSeconds: loadPollInterval(),
  setPollInterval: (pollIntervalSeconds) => {
    const normalized = Math.max(5, Math.min(300, Math.round(pollIntervalSeconds)));
    persistPollInterval(normalized);
    set({ pollIntervalSeconds: normalized });
  },

  autoPinWidget: loadAutoPinWidget(),
  setAutoPinWidget: (autoPinWidget) => {
    persistAutoPinWidget(autoPinWidget);
    set({ autoPinWidget });
  },
}));

export { MAPPINGS_KEY, POLL_INTERVAL_KEY, AUTO_PIN_KEY };
export type { SyncState };
