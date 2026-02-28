import { useNavigationStore } from "@/stores/navigation-store";

export function useNavigation() {
  const selectedTeam = useNavigationStore((state) => state.selectedTeam);
  const selectedChannel = useNavigationStore((state) => state.selectedChannel);
  const driveId = useNavigationStore((state) => state.driveId);
  const currentFolderId = useNavigationStore((state) => state.currentFolderId);
  const pathStack = useNavigationStore((state) => state.pathStack);
  const viewMode = useNavigationStore((state) => state.viewMode);
  const sortBy = useNavigationStore((state) => state.sortBy);
  const sortDirection = useNavigationStore((state) => state.sortDirection);
  const searchQuery = useNavigationStore((state) => state.searchQuery);
  const sidebarCollapsed = useNavigationStore((state) => state.sidebarCollapsed);
  const selectedItem = useNavigationStore((state) => state.selectedItem);
  const detailsOpen = useNavigationStore((state) => state.detailsOpen);

  const setSelectedTeam = useNavigationStore((state) => state.setSelectedTeam);
  const setSelectedChannel = useNavigationStore((state) => state.setSelectedChannel);
  const setDriveContext = useNavigationStore((state) => state.setDriveContext);
  const openFolder = useNavigationStore((state) => state.openFolder);
  const navigateToPath = useNavigationStore((state) => state.navigateToPath);
  const setViewMode = useNavigationStore((state) => state.setViewMode);
  const setSortBy = useNavigationStore((state) => state.setSortBy);
  const setSortDirection = useNavigationStore((state) => state.setSortDirection);
  const setSearchQuery = useNavigationStore((state) => state.setSearchQuery);
  const clearSearch = useNavigationStore((state) => state.clearSearch);
  const setSidebarCollapsed = useNavigationStore((state) => state.setSidebarCollapsed);
  const setSelectedItem = useNavigationStore((state) => state.setSelectedItem);
  const setDetailsOpen = useNavigationStore((state) => state.setDetailsOpen);

  return {
    selectedTeam,
    selectedChannel,
    driveId,
    currentFolderId,
    pathStack,
    viewMode,
    sortBy,
    sortDirection,
    searchQuery,
    sidebarCollapsed,
    selectedItem,
    detailsOpen,
    setSelectedTeam,
    setSelectedChannel,
    setDriveContext,
    openFolder,
    navigateToPath,
    setViewMode,
    setSortBy,
    setSortDirection,
    setSearchQuery,
    clearSearch,
    setSidebarCollapsed,
    setSelectedItem,
    setDetailsOpen,
  };
}

