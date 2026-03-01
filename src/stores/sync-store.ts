import { create } from "zustand";
import type {
  ChannelMapping,
  FileCloneItemState,
  FileCloneLogEntry,
  FileCloneMapping,
  SyncLogEntry,
  SyncTab,
  TeamSpaceMapping,
} from "@/types";

const MAPPINGS_KEY = "sync_channel_mappings";
const POLL_INTERVAL_KEY = "sync_poll_interval_seconds";
const AUTO_PIN_KEY = "sync_auto_pin_widget";
const FILE_CLONE_MAPPINGS_KEY = "file_clone_mappings";
const FILE_CLONE_POLL_INTERVAL_KEY = "file_clone_poll_interval_seconds";
const FILE_CLONE_STATE_INDEX_KEY = "file_clone_state_index";
const FILE_CLONE_COOLDOWN_KEY = "file_clone_cooldown_until";
const TEAM_SPACE_MAPPINGS_KEY = "sync_team_space_mappings";
const SYNC_SCHEMA_VERSION_KEY = "sync_schema_version";
const CURRENT_SYNC_SCHEMA_VERSION = 2;

type MappingStateIndex = Record<string, FileCloneItemState>;
type FileCloneStateIndex = Record<string, MappingStateIndex>;

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

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function loadMappings(): ChannelMapping[] {
  const storage = getSessionStorage();
  const parsed = safeJsonParse<ChannelMapping[]>(storage?.getItem(MAPPINGS_KEY) ?? null, []);

  // Migration for old entries that did not include id/source.
  return parsed.map((mapping) => ({
    ...mapping,
    id: mapping.id || `${mapping.teamId}:${mapping.channelId}`,
    source: mapping.source ?? "teams-channel",
    channelLabel: mapping.channelLabel ?? mapping.channelName,
    driveId: mapping.driveId ?? null,
    rootFolderId: mapping.rootFolderId ?? null,
  }));
}

function persistMappings(mappings: ChannelMapping[]): void {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  storage.setItem(MAPPINGS_KEY, JSON.stringify(mappings));
}

function loadFileCloneMappings(): FileCloneMapping[] {
  const storage = getSessionStorage();
  const parsed = safeJsonParse<FileCloneMapping[]>(
    storage?.getItem(FILE_CLONE_MAPPINGS_KEY) ?? null,
    [],
  );

  // Migration guard for missing canonical fields.
  return parsed.map((mapping) => ({
    ...mapping,
    id: mapping.id || `${mapping.teamId}:${mapping.channelId}`,
    channelNameNormalized:
      mapping.channelNameNormalized ?? mapping.channelLabel.trim().toLowerCase(),
    matrixSpaceId: mapping.matrixSpaceId ?? "",
    canonical: true as const,
    health: mapping.health ?? (mapping.matrixSpaceId ? "ok" : "orphaned"),
    enabled: mapping.matrixSpaceId ? mapping.enabled : false,
  }));
}

function persistFileCloneMappings(mappings: FileCloneMapping[]): void {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  storage.setItem(FILE_CLONE_MAPPINGS_KEY, JSON.stringify(mappings));
}

function loadPollInterval(storageKey: string, defaultValue = 30): number {
  const storage = getSessionStorage();
  const stored = storage?.getItem(storageKey);
  const parsed = stored ? Number.parseInt(stored, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

function persistPollInterval(storageKey: string, seconds: number): void {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  storage.setItem(storageKey, seconds.toString());
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

function loadFileCloneStateIndex(): FileCloneStateIndex {
  const storage = getSessionStorage();
  return safeJsonParse<FileCloneStateIndex>(storage?.getItem(FILE_CLONE_STATE_INDEX_KEY) ?? null, {});
}

function persistFileCloneStateIndex(index: FileCloneStateIndex): void {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  storage.setItem(FILE_CLONE_STATE_INDEX_KEY, JSON.stringify(index));
}

function loadFileCloneCooldowns(): Record<string, string | null> {
  const storage = getSessionStorage();
  const parsed = safeJsonParse<Record<string, string | null>>(
    storage?.getItem(FILE_CLONE_COOLDOWN_KEY) ?? null,
    {},
  );

  const normalized: Record<string, string | null> = {};
  for (const [mappingId, cooldownUntil] of Object.entries(parsed)) {
    if (!cooldownUntil) {
      normalized[mappingId] = null;
      continue;
    }

    const parsedTs = Date.parse(cooldownUntil);
    normalized[mappingId] = Number.isNaN(parsedTs) ? null : new Date(parsedTs).toISOString();
  }

  return normalized;
}

function persistFileCloneCooldowns(cooldowns: Record<string, string | null>): void {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  storage.setItem(FILE_CLONE_COOLDOWN_KEY, JSON.stringify(cooldowns));
}

function loadTeamSpaceMappings(): TeamSpaceMapping[] {
  const storage = getSessionStorage();
  const parsed = safeJsonParse<TeamSpaceMapping[]>(
    storage?.getItem(TEAM_SPACE_MAPPINGS_KEY) ?? null,
    [],
  );

  return parsed
    .filter((mapping) => Boolean(mapping.teamId && mapping.matrixSpaceId))
    .map((mapping) => ({
      ...mapping,
      canonical: true as const,
      createdAt: mapping.createdAt || new Date().toISOString(),
    }));
}

function persistTeamSpaceMappings(mappings: TeamSpaceMapping[]): void {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  storage.setItem(TEAM_SPACE_MAPPINGS_KEY, JSON.stringify(mappings));
}

function loadSyncSchemaVersion(): number {
  const storage = getSessionStorage();
  const raw = storage?.getItem(SYNC_SCHEMA_VERSION_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 1;
}

function persistSyncSchemaVersion(version: number): void {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }
  storage.setItem(SYNC_SCHEMA_VERSION_KEY, String(version));
}

interface SyncState {
  syncSchemaVersion: number;
  setSyncSchemaVersion: (version: number) => void;

  activeTab: SyncTab;
  setActiveTab: (tab: SyncTab) => void;

  mappings: ChannelMapping[];
  addMapping: (mapping: ChannelMapping) => void;
  removeMapping: (mappingId: string) => void;
  updateMapping: (mappingId: string, updates: Partial<ChannelMapping>) => void;
  setMappings: (mappings: ChannelMapping[]) => void;

  syncRunning: boolean;
  setSyncRunning: (running: boolean) => void;
  syncErrors: Record<string, string>;
  setSyncError: (mappingId: string, error: string | null) => void;

  syncLog: SyncLogEntry[];
  addLogEntry: (entry: Omit<SyncLogEntry, "kind"> & { kind?: "messages" | "files" }) => void;
  clearMessageLog: () => void;

  pollIntervalSeconds: number;
  setPollInterval: (seconds: number) => void;

  autoPinWidget: boolean;
  setAutoPinWidget: (pin: boolean) => void;

  teamSpaceMappings: TeamSpaceMapping[];
  addOrUpdateTeamSpaceMapping: (mapping: TeamSpaceMapping) => void;
  removeTeamSpaceMapping: (teamId: string) => void;
  setTeamSpaceMappings: (mappings: TeamSpaceMapping[]) => void;

  fileCloneMappings: FileCloneMapping[];
  addFileCloneMapping: (mapping: FileCloneMapping) => void;
  removeFileCloneMapping: (mappingId: string) => void;
  updateFileCloneMapping: (mappingId: string, updates: Partial<FileCloneMapping>) => void;
  setFileCloneMappings: (mappings: FileCloneMapping[]) => void;

  fileCloneRunning: boolean;
  setFileCloneRunning: (running: boolean) => void;
  fileCloneErrors: Record<string, string>;
  setFileCloneError: (mappingId: string, error: string | null) => void;

  fileCloneLog: FileCloneLogEntry[];
  addFileCloneLogEntry: (
    entry: Omit<FileCloneLogEntry, "kind"> & { kind?: "files" },
  ) => void;
  clearFileCloneLog: () => void;

  fileClonePollIntervalSeconds: number;
  setFileClonePollInterval: (seconds: number) => void;

  fileCloneStateIndex: FileCloneStateIndex;
  setFileCloneMappingState: (mappingId: string, index: MappingStateIndex) => void;
  upsertFileCloneItemState: (mappingId: string, item: FileCloneItemState) => void;
  removeFileCloneItemState: (mappingId: string, driveItemId: string) => void;
  clearFileCloneMappingState: (mappingId: string) => void;
  fileCloneCooldownUntilByMappingId: Record<string, string | null>;
  setFileCloneCooldown: (mappingId: string, cooldownUntil: string | null) => void;

  clearLog: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  syncSchemaVersion: loadSyncSchemaVersion(),
  setSyncSchemaVersion: (syncSchemaVersion) => {
    persistSyncSchemaVersion(syncSchemaVersion);
    set({ syncSchemaVersion });
  },

  activeTab: "files",
  setActiveTab: (activeTab) => set({ activeTab }),

  mappings: loadMappings(),
  addMapping: (mapping) =>
    set((state) => {
      const withoutOld = state.mappings.filter((entry) => entry.id !== mapping.id);
      const mappings = [...withoutOld, mapping];
      persistMappings(mappings);
      return { mappings };
    }),
  removeMapping: (mappingId) =>
    set((state) => {
      const mappings = state.mappings.filter((entry) => entry.id !== mappingId);
      persistMappings(mappings);

      const nextErrors = { ...state.syncErrors };
      delete nextErrors[mappingId];

      return { mappings, syncErrors: nextErrors };
    }),
  updateMapping: (mappingId, updates) =>
    set((state) => {
      const mappings = state.mappings.map((entry) =>
        entry.id === mappingId ? { ...entry, ...updates } : entry,
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
  setSyncError: (mappingId, error) =>
    set((state) => {
      if (!error) {
        if (!state.syncErrors[mappingId]) {
          return state;
        }

        const nextErrors = { ...state.syncErrors };
        delete nextErrors[mappingId];
        return { syncErrors: nextErrors };
      }

      return {
        syncErrors: {
          ...state.syncErrors,
          [mappingId]: error,
        },
      };
    }),

  syncLog: [],
  addLogEntry: (entry) =>
    set((state) => {
      const next = [{ ...entry, kind: entry.kind ?? "messages" } as SyncLogEntry, ...state.syncLog].slice(
        0,
        100,
      );
      return { syncLog: next };
    }),
  clearMessageLog: () => set({ syncLog: [] }),

  pollIntervalSeconds: loadPollInterval(POLL_INTERVAL_KEY, 30),
  setPollInterval: (pollIntervalSeconds) => {
    const normalized = Math.max(5, Math.min(300, Math.round(pollIntervalSeconds)));
    persistPollInterval(POLL_INTERVAL_KEY, normalized);
    set({ pollIntervalSeconds: normalized });
  },

  autoPinWidget: loadAutoPinWidget(),
  setAutoPinWidget: (autoPinWidget) => {
    persistAutoPinWidget(autoPinWidget);
    set({ autoPinWidget });
  },

  teamSpaceMappings: loadTeamSpaceMappings(),
  addOrUpdateTeamSpaceMapping: (mapping) =>
    set((state) => {
      const withoutOld = state.teamSpaceMappings.filter((entry) => entry.teamId !== mapping.teamId);
      const teamSpaceMappings = [...withoutOld, { ...mapping, canonical: true as const }];
      persistTeamSpaceMappings(teamSpaceMappings);
      return { teamSpaceMappings };
    }),
  removeTeamSpaceMapping: (teamId) =>
    set((state) => {
      const teamSpaceMappings = state.teamSpaceMappings.filter((entry) => entry.teamId !== teamId);
      persistTeamSpaceMappings(teamSpaceMappings);
      return { teamSpaceMappings };
    }),
  setTeamSpaceMappings: (teamSpaceMappings) => {
    persistTeamSpaceMappings(teamSpaceMappings);
    set({ teamSpaceMappings });
  },

  fileCloneMappings: loadFileCloneMappings(),
  addFileCloneMapping: (mapping) =>
    set((state) => {
      const withoutOld = state.fileCloneMappings.filter((entry) => entry.id !== mapping.id);
      const fileCloneMappings = [...withoutOld, mapping];
      persistFileCloneMappings(fileCloneMappings);
      return { fileCloneMappings };
    }),
  removeFileCloneMapping: (mappingId) =>
    set((state) => {
      const fileCloneMappings = state.fileCloneMappings.filter((entry) => entry.id !== mappingId);
      persistFileCloneMappings(fileCloneMappings);

      const nextErrors = { ...state.fileCloneErrors };
      delete nextErrors[mappingId];

      const nextIndex = { ...state.fileCloneStateIndex };
      delete nextIndex[mappingId];
      persistFileCloneStateIndex(nextIndex);

      const nextCooldowns = { ...state.fileCloneCooldownUntilByMappingId };
      delete nextCooldowns[mappingId];
      persistFileCloneCooldowns(nextCooldowns);

      return {
        fileCloneMappings,
        fileCloneErrors: nextErrors,
        fileCloneStateIndex: nextIndex,
        fileCloneCooldownUntilByMappingId: nextCooldowns,
      };
    }),
  updateFileCloneMapping: (mappingId, updates) =>
    set((state) => {
      const fileCloneMappings = state.fileCloneMappings.map((entry) =>
        entry.id === mappingId ? { ...entry, ...updates } : entry,
      );
      persistFileCloneMappings(fileCloneMappings);
      return { fileCloneMappings };
    }),
  setFileCloneMappings: (fileCloneMappings) => {
    persistFileCloneMappings(fileCloneMappings);
    set({ fileCloneMappings });
  },

  fileCloneRunning: false,
  setFileCloneRunning: (fileCloneRunning) => set({ fileCloneRunning }),

  fileCloneErrors: {},
  setFileCloneError: (mappingId, error) =>
    set((state) => {
      if (!error) {
        if (!state.fileCloneErrors[mappingId]) {
          return state;
        }

        const nextErrors = { ...state.fileCloneErrors };
        delete nextErrors[mappingId];
        return { fileCloneErrors: nextErrors };
      }

      return {
        fileCloneErrors: {
          ...state.fileCloneErrors,
          [mappingId]: error,
        },
      };
    }),

  fileCloneLog: [],
  addFileCloneLogEntry: (entry) =>
    set((state) => {
      const next = [{ ...entry, kind: "files" } as FileCloneLogEntry, ...state.fileCloneLog].slice(
        0,
        100,
      );
      return { fileCloneLog: next };
    }),
  clearFileCloneLog: () => set({ fileCloneLog: [] }),

  fileClonePollIntervalSeconds: loadPollInterval(FILE_CLONE_POLL_INTERVAL_KEY, 30),
  setFileClonePollInterval: (fileClonePollIntervalSeconds) => {
    const normalized = Math.max(5, Math.min(300, Math.round(fileClonePollIntervalSeconds)));
    persistPollInterval(FILE_CLONE_POLL_INTERVAL_KEY, normalized);
    set({ fileClonePollIntervalSeconds: normalized });
  },

  fileCloneStateIndex: loadFileCloneStateIndex(),
  setFileCloneMappingState: (mappingId, index) =>
    set((state) => {
      const fileCloneStateIndex = {
        ...state.fileCloneStateIndex,
        [mappingId]: index,
      };
      persistFileCloneStateIndex(fileCloneStateIndex);
      return { fileCloneStateIndex };
    }),
  upsertFileCloneItemState: (mappingId, item) =>
    set((state) => {
      const mappingIndex = state.fileCloneStateIndex[mappingId] ?? {};
      const nextMappingIndex = {
        ...mappingIndex,
        [item.driveItemId]: item,
      };
      const fileCloneStateIndex = {
        ...state.fileCloneStateIndex,
        [mappingId]: nextMappingIndex,
      };
      persistFileCloneStateIndex(fileCloneStateIndex);
      return { fileCloneStateIndex };
    }),
  removeFileCloneItemState: (mappingId, driveItemId) =>
    set((state) => {
      const mappingIndex = state.fileCloneStateIndex[mappingId];
      if (!mappingIndex || !mappingIndex[driveItemId]) {
        return state;
      }

      const nextMappingIndex = { ...mappingIndex };
      delete nextMappingIndex[driveItemId];

      const fileCloneStateIndex = {
        ...state.fileCloneStateIndex,
        [mappingId]: nextMappingIndex,
      };
      persistFileCloneStateIndex(fileCloneStateIndex);
      return { fileCloneStateIndex };
    }),
  clearFileCloneMappingState: (mappingId) =>
    set((state) => {
      const fileCloneStateIndex = { ...state.fileCloneStateIndex };
      delete fileCloneStateIndex[mappingId];
      persistFileCloneStateIndex(fileCloneStateIndex);
      return { fileCloneStateIndex };
    }),

  fileCloneCooldownUntilByMappingId: loadFileCloneCooldowns(),
  setFileCloneCooldown: (mappingId, cooldownUntil) =>
    set((state) => {
      const fileCloneCooldownUntilByMappingId = {
        ...state.fileCloneCooldownUntilByMappingId,
        [mappingId]: cooldownUntil,
      };
      persistFileCloneCooldowns(fileCloneCooldownUntilByMappingId);
      return { fileCloneCooldownUntilByMappingId };
    }),

  clearLog: () => set({ syncLog: [], fileCloneLog: [] }),
}));

export {
  AUTO_PIN_KEY,
  FILE_CLONE_MAPPINGS_KEY,
  FILE_CLONE_POLL_INTERVAL_KEY,
  FILE_CLONE_STATE_INDEX_KEY,
  FILE_CLONE_COOLDOWN_KEY,
  MAPPINGS_KEY,
  POLL_INTERVAL_KEY,
  TEAM_SPACE_MAPPINGS_KEY,
  CURRENT_SYNC_SCHEMA_VERSION,
  SYNC_SCHEMA_VERSION_KEY,
};
export type { FileCloneStateIndex, MappingStateIndex, SyncState };
