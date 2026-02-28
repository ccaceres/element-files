import { create } from "zustand";
import type {
  Channel,
  DriveItem,
  NavigationPath,
  SortBy,
  SortDirection,
  Team,
  ViewMode,
} from "@/types";

interface NavigationStoreState {
  selectedTeam: Team | null;
  selectedChannel: Channel | null;
  driveId: string | null;
  currentFolderId: string | null;
  pathStack: NavigationPath[];
  rootFolderId: string | null;
  viewMode: ViewMode;
  sortBy: SortBy;
  sortDirection: SortDirection;
  searchQuery: string;
  sidebarCollapsed: boolean;
  selectedItem: DriveItem | null;
  detailsOpen: boolean;
  setSelectedTeam: (team: Team | null) => void;
  setSelectedChannel: (channel: Channel | null) => void;
  setDriveContext: (driveId: string, rootFolderId: string, rootName: string) => void;
  openFolder: (folder: DriveItem) => void;
  navigateToPath: (pathIndex: number) => void;
  setViewMode: (mode: ViewMode) => void;
  setSortBy: (sortBy: SortBy) => void;
  setSortDirection: (direction: SortDirection) => void;
  setSearchQuery: (query: string) => void;
  clearSearch: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSelectedItem: (item: DriveItem | null) => void;
  setDetailsOpen: (open: boolean) => void;
  reset: () => void;
}

function isWidgetIframe(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

const defaultState = {
  selectedTeam: null,
  selectedChannel: null,
  driveId: null,
  currentFolderId: null,
  rootFolderId: null,
  pathStack: [] as NavigationPath[],
  viewMode: "list" as ViewMode,
  sortBy: "name" as SortBy,
  sortDirection: "asc" as SortDirection,
  searchQuery: "",
  sidebarCollapsed: isWidgetIframe(),
  selectedItem: null,
  detailsOpen: false,
};

export const useNavigationStore = create<NavigationStoreState>((set) => ({
  ...defaultState,
  setSelectedTeam: (team) =>
    set({
      selectedTeam: team,
      selectedChannel: null,
      driveId: null,
      currentFolderId: null,
      rootFolderId: null,
      pathStack: [],
      searchQuery: "",
      selectedItem: null,
      detailsOpen: false,
    }),
  setSelectedChannel: (channel) =>
    set({
      selectedChannel: channel,
      driveId: null,
      currentFolderId: null,
      rootFolderId: null,
      pathStack: [],
      searchQuery: "",
      selectedItem: null,
      detailsOpen: false,
    }),
  setDriveContext: (driveId, rootFolderId, rootName) =>
    set({
      driveId,
      rootFolderId,
      currentFolderId: rootFolderId,
      pathStack: [{ id: rootFolderId, name: rootName }],
      searchQuery: "",
      selectedItem: null,
      detailsOpen: false,
    }),
  openFolder: (folder) =>
    set((state) => ({
      currentFolderId: folder.id,
      pathStack: [...state.pathStack, { id: folder.id, name: folder.name }],
      selectedItem: null,
      detailsOpen: false,
    })),
  navigateToPath: (pathIndex) =>
    set((state) => {
      if (pathIndex < 0 || pathIndex >= state.pathStack.length) {
        return state;
      }
      const nextStack = state.pathStack.slice(0, pathIndex + 1);
      return {
        pathStack: nextStack,
        currentFolderId: nextStack[nextStack.length - 1]?.id ?? state.rootFolderId,
        selectedItem: null,
        detailsOpen: false,
      };
    }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSortBy: (sortBy) =>
    set((state) => {
      if (state.sortBy === sortBy) {
        return {
          sortDirection: state.sortDirection === "asc" ? "desc" : "asc",
        };
      }
      return { sortBy, sortDirection: "asc" };
    }),
  setSortDirection: (sortDirection) => set({ sortDirection }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  clearSearch: () => set({ searchQuery: "" }),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setSelectedItem: (selectedItem) => set({ selectedItem }),
  setDetailsOpen: (detailsOpen) => set({ detailsOpen }),
  reset: () => set(defaultState),
}));

export type { NavigationStoreState };

