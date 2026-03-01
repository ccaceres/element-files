import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getChannelFilesFolder, getFileContentBlob } from "@/api/files";
import { sendFile } from "@/api/matrix-rooms";
import { getUserPhotoDataUrl } from "@/api/teams";
import { TokenEntryScreen } from "@/auth/TokenEntryScreen";
import { useTokenContext } from "@/auth/TokenContext";
import { matrixTokenManager } from "@/auth/token-manager";
import { EmptyState } from "@/components/common/EmptyState";
import { Skeleton } from "@/components/common/Skeleton";
import { DetailsPanel } from "@/components/files/DetailsPanel";
import { FileGrid } from "@/components/files/FileGrid";
import { FileList } from "@/components/files/FileList";
import { Sidebar } from "@/components/layout/Sidebar";
import { TabBar } from "@/components/layout/TabBar";
import { Toolbar } from "@/components/layout/Toolbar";
import { SyncDashboard } from "@/components/sync/SyncDashboard";
import { useChannels } from "@/hooks/useChannels";
import { useFiles } from "@/hooks/useFiles";
import { useNavigation } from "@/hooks/useNavigation";
import { useSearch } from "@/hooks/useSearch";
import { useTeams } from "@/hooks/useTeams";
import { CURRENT_SYNC_SCHEMA_VERSION, useSyncStore } from "@/stores/sync-store";
import type { DriveItem } from "@/types";
import { mapGraphError, type ErrorContext } from "@/utils/errors";

export function AppShell() {
  const queryClient = useQueryClient();
  const { user, clearToken, status, matrixStatus, matrixToken } = useTokenContext();
  const effectiveMatrixToken = matrixToken ?? matrixTokenManager.getToken();

  const activeTab = useSyncStore((state) => state.activeTab);
  const setActiveTab = useSyncStore((state) => state.setActiveTab);
  const syncSchemaVersion = useSyncStore((state) => state.syncSchemaVersion);
  const setSyncSchemaVersion = useSyncStore((state) => state.setSyncSchemaVersion);
  const syncRunning = useSyncStore((state) => state.syncRunning);
  const mappingCount = useSyncStore((state) => state.mappings.length);
  const pollIntervalSeconds = useSyncStore((state) => state.pollIntervalSeconds);
  const fileCloneRunning = useSyncStore((state) => state.fileCloneRunning);
  const fileClonePollIntervalSeconds = useSyncStore((state) => state.fileClonePollIntervalSeconds);
  const mappings = useSyncStore((state) => state.mappings);
  const fileCloneMappings = useSyncStore((state) => state.fileCloneMappings);
  const teamSpaceMappings = useSyncStore((state) => state.teamSpaceMappings);
  const setFileCloneMappings = useSyncStore((state) => state.setFileCloneMappings);
  const setTeamSpaceMappings = useSyncStore((state) => state.setTeamSpaceMappings);

  const {
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
  } = useNavigation();

  const [showTokenModal, setShowTokenModal] = useState(false);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  const teamsQuery = useTeams();
  const channelsQuery = useChannels(selectedTeam?.id ?? null);

  const filesFolderQuery = useQuery({
    queryKey: [
      "files-folder",
      selectedTeam?.id,
      selectedChannel?.id,
      selectedChannel?.source,
      selectedChannel?.driveId,
      selectedChannel?.folderId,
    ],
    queryFn: async () => {
      if (
        selectedChannel?.source === "drive-folder" &&
        selectedChannel.driveId &&
        selectedChannel.folderId
      ) {
        return {
          id: selectedChannel.folderId,
          name: selectedChannel.displayName,
          parentReference: {
            driveId: selectedChannel.driveId,
          },
        };
      }

      return getChannelFilesFolder(selectedTeam?.id ?? "", selectedChannel?.id ?? "");
    },
    enabled: Boolean(selectedTeam?.id && selectedChannel?.id),
    staleTime: 5 * 60 * 1000,
  });

  const userPhotoQuery = useQuery({
    queryKey: ["user-photo", user?.id],
    queryFn: () => getUserPhotoDataUrl(user?.id ?? ""),
    enabled: Boolean(user?.id),
    staleTime: 10 * 60 * 1000,
  });

  const filesTabActive = activeTab === "files";

  const filesQuery = useFiles({
    driveId: filesTabActive ? driveId : null,
    folderId: filesTabActive ? currentFolderId : null,
    sortBy,
    sortDirection,
  });

  const searchResultsQuery = useSearch({
    driveId: filesTabActive ? driveId : null,
    query: searchQuery,
    sortBy,
    sortDirection,
  });

  const searchActive = searchQuery.trim().length > 0;

  useEffect(() => {
    if (!teamsQuery.data || teamsQuery.data.length === 0) {
      return;
    }

    if (!selectedTeam) {
      setSelectedTeam(teamsQuery.data[0]);
    }
  }, [selectedTeam, setSelectedTeam, teamsQuery.data]);

  useEffect(() => {
    if (!channelsQuery.data || channelsQuery.data.length === 0) {
      return;
    }

    if (!selectedChannel) {
      setSelectedChannel(channelsQuery.data[0]);
    }
  }, [channelsQuery.data, selectedChannel, setSelectedChannel]);

  useEffect(() => {
    if (!filesFolderQuery.data || !selectedTeam || !selectedChannel) {
      return;
    }

    const rootLabel = `${selectedTeam.displayName} > ${selectedChannel.displayName}`;
    setDriveContext(
      filesFolderQuery.data.parentReference.driveId,
      filesFolderQuery.data.id,
      rootLabel,
    );
  }, [filesFolderQuery.data, selectedChannel, selectedTeam, setDriveContext]);

  useEffect(() => {
    if (!copyNotice) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCopyNotice(null);
    }, 2000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [copyNotice]);

  useEffect(() => {
    if (syncSchemaVersion >= CURRENT_SYNC_SCHEMA_VERSION) {
      return;
    }

    const normalizedMappings = fileCloneMappings.map((mapping) => {
      const matrixSpaceId = mapping.matrixSpaceId ?? "";
      return {
        ...mapping,
        id: mapping.id || `${mapping.teamId}:${mapping.channelId}`,
        channelNameNormalized:
          mapping.channelNameNormalized ?? mapping.channelLabel.trim().toLowerCase(),
        matrixSpaceId,
        canonical: true as const,
        health: mapping.health ?? (matrixSpaceId ? "ok" : "orphaned"),
        enabled: matrixSpaceId ? mapping.enabled : false,
      };
    });

    const nextSpaceMappings = new Map<string, (typeof teamSpaceMappings)[number]>();
    for (const mapping of teamSpaceMappings) {
      if (mapping.teamId && mapping.matrixSpaceId) {
        nextSpaceMappings.set(mapping.teamId, {
          ...mapping,
          canonical: true as const,
          createdAt: mapping.createdAt || new Date().toISOString(),
        });
      }
    }

    for (const mapping of normalizedMappings) {
      if (!mapping.matrixSpaceId) {
        continue;
      }
      if (!nextSpaceMappings.has(mapping.teamId)) {
        nextSpaceMappings.set(mapping.teamId, {
          teamId: mapping.teamId,
          teamName: mapping.teamName,
          matrixSpaceId: mapping.matrixSpaceId,
          canonical: true,
          createdAt: new Date().toISOString(),
        });
      }
    }

    setFileCloneMappings(normalizedMappings);
    setTeamSpaceMappings([...nextSpaceMappings.values()]);
    setSyncSchemaVersion(CURRENT_SYNC_SCHEMA_VERSION);
  }, [
    fileCloneMappings,
    setFileCloneMappings,
    setSyncSchemaVersion,
    setTeamSpaceMappings,
    syncSchemaVersion,
    teamSpaceMappings,
  ]);

  const activeQuery = searchActive ? searchResultsQuery : filesQuery;
  const items = activeQuery.data ?? [];

  const loading =
    teamsQuery.isLoading ||
    channelsQuery.isLoading ||
    filesFolderQuery.isLoading ||
    (filesTabActive && activeQuery.isLoading);

  let errorContext: ErrorContext | null = null;
  let activeError: unknown = null;

  if (teamsQuery.error) {
    activeError = teamsQuery.error;
    errorContext = "teams";
  } else if (channelsQuery.error) {
    activeError = channelsQuery.error;
    errorContext = "channels";
  } else if (filesFolderQuery.error) {
    activeError = filesFolderQuery.error;
    errorContext = "filesFolder";
  } else if (filesTabActive && activeQuery.error) {
    activeError = activeQuery.error;
    errorContext = searchActive ? "search" : "files";
  }

  const uiError = activeError && errorContext ? mapGraphError(activeError, errorContext) : null;
  const channelError =
    channelsQuery.error && selectedTeam
      ? mapGraphError(channelsQuery.error, "channels").description
      : null;

  const toolbarPath = useMemo(() => {
    if (pathStack.length > 0) {
      return pathStack;
    }

    if (selectedTeam && selectedChannel) {
      return [{ id: "root", name: `${selectedTeam.displayName} > ${selectedChannel.displayName}` }];
    }

    return [];
  }, [pathStack, selectedChannel, selectedTeam]);

  if (!user) {
    return <div className="min-h-screen bg-app-bg" />;
  }

  function handleRefresh(): void {
    if (driveId && currentFolderId) {
      void queryClient.invalidateQueries({ queryKey: ["files", driveId, currentFolderId] });
    }

    if (driveId && searchActive) {
      void queryClient.invalidateQueries({ queryKey: ["search", driveId, searchQuery.trim()] });
    }

    if (selectedTeam && selectedChannel) {
      void queryClient.invalidateQueries({
        queryKey: ["files-folder", selectedTeam.id, selectedChannel.id],
      });
    }
  }

  function openInBrowser(item: DriveItem): void {
    window.open(item.webUrl, "_blank", "noopener,noreferrer");
  }

  function downloadFile(item: DriveItem): void {
    const url = item["@microsoft.graph.downloadUrl"] || item.webUrl;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function copyLink(item: DriveItem): Promise<void> {
    try {
      await navigator.clipboard.writeText(item.webUrl);
      setCopyNotice("Link copied to clipboard.");
    } catch {
      setCopyNotice("Could not copy link.");
    }
  }

  function findCurrentChannelRoomId(): string | null {
    if (!selectedTeam || !selectedChannel) {
      return null;
    }

    const mappingId = `${selectedTeam.id}:${selectedChannel.id}`;
    const cloneMapping = fileCloneMappings.find((mapping) => mapping.id === mappingId);
    if (cloneMapping) {
      return cloneMapping.matrixRoomId;
    }

    const messageMapping = mappings.find((mapping) => mapping.id === mappingId);
    return messageMapping?.matrixRoomId ?? null;
  }

  async function sendToElement(item: DriveItem): Promise<void> {
    if (item.folder) {
      return;
    }

    if (!driveId) {
      setCopyNotice("No active drive context for this file.");
      return;
    }

    if (!effectiveMatrixToken) {
      setCopyNotice("Matrix token missing. Add it in the token modal.");
      return;
    }

    const roomId = findCurrentChannelRoomId();
    if (!roomId) {
      setCopyNotice("No Element room mapping for this channel. Use Sync tab Quick Setup first.");
      return;
    }

    setCopyNotice(`Sending "${item.name}" to Element...`);

    try {
      const fileBlob = await getFileContentBlob(driveId, item.id);
      const mimeType = item.file?.mimeType || fileBlob.type || "application/octet-stream";

      await sendFile(roomId, fileBlob, {
        filename: item.name,
        mimeType,
        size: item.size ?? fileBlob.size,
      });

      setCopyNotice(`Sent "${item.name}" to Element room.`);
    } catch {
      setCopyNotice(`Could not send "${item.name}" to Element room.`);
    }
  }

  function handleSelectItem(item: DriveItem): void {
    setSelectedItem(item);
  }

  function handleDetails(item: DriveItem): void {
    setSelectedItem(item);
    setDetailsOpen(true);
  }

  function handleOpenFolder(item: DriveItem): void {
    if (!item.folder) {
      return;
    }

    if (searchActive) {
      clearSearch();
    }

    openFolder(item);
  }

  return (
    <div className="flex min-h-screen bg-app-bg text-text-primary">
      <Sidebar
        user={user}
        photoUrl={userPhotoQuery.data}
        teams={teamsQuery.data ?? []}
        channels={channelsQuery.data ?? []}
        teamsLoading={teamsQuery.isLoading}
        channelsLoading={channelsQuery.isLoading}
        channelsError={selectedTeam ? channelError : null}
        selectedTeam={selectedTeam}
        selectedChannel={selectedChannel}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onSelectTeam={setSelectedTeam}
        onSelectChannel={setSelectedChannel}
        onSignOut={clearToken}
      />

      <main className="relative flex min-w-0 flex-1 flex-col bg-app-content">
        <Toolbar
          activeTab={activeTab}
          pathStack={toolbarPath}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSortChange={setSortBy}
          onSortDirectionChange={setSortDirection}
          onNavigateToPath={navigateToPath}
          onRefresh={handleRefresh}
          tokenStatus={status}
          matrixStatus={matrixStatus}
          onTokenClick={() => setShowTokenModal(true)}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          searchActive={searchActive}
          syncRunning={activeTab === "sync" ? fileCloneRunning : syncRunning}
          mappingCount={activeTab === "sync" ? fileCloneMappings.length : mappingCount}
          pollIntervalSeconds={
            activeTab === "sync" ? fileClonePollIntervalSeconds : pollIntervalSeconds
          }
        />

        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === "files" ? (
          <section className="flex-1 overflow-auto p-4">
            {copyNotice ? (
              <div className="mb-3 rounded border border-border-default bg-app-surface px-3 py-2 text-xs text-text-secondary">
                {copyNotice}
              </div>
            ) : null}

            {loading ? <Skeleton rows={8} /> : null}

            {!loading && uiError ? (
              <EmptyState
                title={uiError.title}
                description={uiError.description}
                actionLabel="Retry"
                onAction={handleRefresh}
              />
            ) : null}

            {!loading && !uiError && teamsQuery.data?.length === 0 ? (
              <EmptyState
                title="No Teams found"
                description="This account is not currently joined to any Teams visible via Graph API."
              />
            ) : null}

            {!loading && !uiError && teamsQuery.data?.length !== 0 && items.length === 0 ? (
              <EmptyState
                title={searchActive ? "No matching files" : "No files yet"}
                description={
                  searchActive
                    ? "No files matched your search query in this channel drive."
                    : "This channel does not have any files yet."
                }
                actionLabel={searchActive ? "Back to folder view" : undefined}
                onAction={searchActive ? clearSearch : undefined}
              />
            ) : null}

            {!loading && !uiError && items.length > 0 ? (
              viewMode === "list" ? (
                <FileList
                  items={items}
                  selectedItemId={selectedItem?.id ?? null}
                  onSelectItem={handleSelectItem}
                  onOpenFolder={handleOpenFolder}
                  onDownload={downloadFile}
                  onOpenInBrowser={openInBrowser}
                  onCopyLink={(item) => {
                    void copyLink(item);
                  }}
                  onSendToElement={(item) => {
                    void sendToElement(item);
                  }}
                  onDetails={handleDetails}
                />
              ) : (
                <FileGrid
                  items={items}
                  selectedItemId={selectedItem?.id ?? null}
                  onSelectItem={handleSelectItem}
                  onOpenFolder={handleOpenFolder}
                  onDownload={downloadFile}
                  onOpenInBrowser={openInBrowser}
                  onCopyLink={(item) => {
                    void copyLink(item);
                  }}
                  onSendToElement={(item) => {
                    void sendToElement(item);
                  }}
                  onDetails={handleDetails}
                />
              )
            ) : null}
          </section>
        ) : (
          <div className="flex-1 overflow-auto">
            <SyncDashboard />
          </div>
        )}

        {activeTab === "files" ? (
          <DetailsPanel
            open={detailsOpen}
            item={selectedItem}
            driveId={driveId}
            onOpenChange={setDetailsOpen}
          />
        ) : null}

        {showTokenModal ? (
          <TokenEntryScreen
            mode="overlay"
            onSuccess={() => setShowTokenModal(false)}
            onCancel={() => setShowTokenModal(false)}
          />
        ) : null}

        {status === "expired" ? <TokenEntryScreen mode="overlay" forceExpired /> : null}
      </main>
    </div>
  );
}
