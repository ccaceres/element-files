import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { DismissRegular } from "@fluentui/react-icons";
import { createRoom, setWidgetInRoom } from "@/api/matrix-rooms";
import { useTokenContext } from "@/auth/TokenContext";
import { useChannels } from "@/hooks/useChannels";
import { useMatrixRooms } from "@/hooks/useMatrixRooms";
import { useTeams } from "@/hooks/useTeams";
import { backfillMessages } from "@/sync/room-setup";
import type { ChannelMapping } from "@/types";
import { mapGraphError } from "@/utils/errors";

interface ChannelMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  autoPinWidget: boolean;
  onAutoPinWidgetChange: (pin: boolean) => void;
  onMappingCreated: (mapping: ChannelMapping) => void;
}

export function ChannelMappingDialog({
  open,
  onOpenChange,
  autoPinWidget,
  onAutoPinWidgetChange,
  onMappingCreated,
}: ChannelMappingDialogProps) {
  const teamsQuery = useTeams();
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const channelsQuery = useChannels(selectedTeamId || null);
  const matrixRoomsQuery = useMatrixRooms();
  const { matrixUserId } = useTokenContext();

  const [roomMode, setRoomMode] = useState<"create" | "existing">("create");
  const [existingRoomId, setExistingRoomId] = useState("");
  const [createRoomName, setCreateRoomName] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [importHistory, setImportHistory] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (teamsQuery.data && teamsQuery.data.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teamsQuery.data[0]?.id ?? "");
    }
  }, [selectedTeamId, teamsQuery.data]);

  const selectableChannels = useMemo(
    () =>
      (channelsQuery.data ?? []).filter((channel) => {
        return channel.source === "teams-channel";
      }),
    [channelsQuery.data],
  );

  useEffect(() => {
    if (selectableChannels.length > 0) {
      const exists = selectableChannels.some((channel) => channel.id === selectedChannelId);
      if (!exists) {
        setSelectedChannelId(selectableChannels[0]?.id ?? "");
      }
    } else {
      setSelectedChannelId("");
    }
  }, [selectableChannels, selectedChannelId]);

  const selectedTeam = useMemo(
    () => (teamsQuery.data ?? []).find((team) => team.id === selectedTeamId) ?? null,
    [selectedTeamId, teamsQuery.data],
  );

  const selectedChannel = useMemo(
    () => selectableChannels.find((channel) => channel.id === selectedChannelId) ?? null,
    [selectableChannels, selectedChannelId],
  );

  const blockReason = useMemo(() => {
    if (channelsQuery.error) {
      return mapGraphError(channelsQuery.error, "channels").description;
    }

    if (!channelsQuery.isLoading && selectedTeamId && selectableChannels.length === 0) {
      return "Message sync unavailable for this team (channel API blocked). File clone is available via SharePoint folder mode.";
    }

    return null;
  }, [channelsQuery.error, channelsQuery.isLoading, selectableChannels.length, selectedTeamId]);

  async function handleSubmit(): Promise<void> {
    setSubmitting(true);
    setError(null);

    try {
      if (!selectedTeam || !selectedChannel) {
        setError("Choose a team and a channel.");
        return;
      }

      let roomId = existingRoomId;

      if (roomMode === "create") {
        const generatedName = createRoomName.trim() || `${selectedTeam.displayName} - ${selectedChannel.displayName}`;
        const created = await createRoom({
          name: generatedName,
          topic: `Bridged from Teams: ${selectedTeam.displayName} > ${selectedChannel.displayName}`,
          preset: "private_chat",
        });
        roomId = created.room_id;

        if (autoPinWidget && matrixUserId) {
          await setWidgetInRoom(
            roomId,
            `files-widget-${selectedChannel.id}`,
            window.location.origin,
            "ICC-LAB Files",
            matrixUserId,
          );
        }
      }

      if (!roomId) {
        setError("Choose an existing room or create a new one.");
        return;
      }

      const mapping: ChannelMapping = {
        id: `${selectedTeam.id}:${selectedChannel.id}`,
        teamId: selectedTeam.id,
        teamName: selectedTeam.displayName,
        channelId: selectedChannel.id,
        channelName: selectedChannel.displayName,
        channelLabel: selectedChannel.displayName,
        source: "teams-channel",
        driveId: null,
        rootFolderId: null,
        matrixRoomId: roomId,
        lastSyncedMessageId: null,
        lastSyncedAt: null,
        enabled: true,
      };

      if (importHistory) {
        await backfillMessages(mapping, 50);
      }

      onMappingCreated(mapping);
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create mapping.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-40 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border-default bg-app-content p-5 shadow-panel focus:outline-none">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-text-primary">
              Map Teams Channel to Element Room
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded p-1 text-text-secondary transition hover:bg-app-hover"
                aria-label="Close mapping dialog"
              >
                <DismissRegular fontSize={16} />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="mb-4 text-xs text-text-secondary">
            Choose a real Teams channel and map it to an Element room for live message sync.
          </Dialog.Description>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-text-secondary" htmlFor="mapping-team">
                Team
              </label>
              <select
                id="mapping-team"
                className="w-full rounded border border-border-default bg-app-surface px-2 py-2 text-sm text-text-primary outline-none"
                value={selectedTeamId}
                onChange={(event) => setSelectedTeamId(event.target.value)}
              >
                {(teamsQuery.data ?? []).map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-text-secondary" htmlFor="mapping-channel">
                Channel
              </label>
              <select
                id="mapping-channel"
                className="w-full rounded border border-border-default bg-app-surface px-2 py-2 text-sm text-text-primary outline-none"
                value={selectedChannelId}
                onChange={(event) => setSelectedChannelId(event.target.value)}
                disabled={selectableChannels.length === 0}
              >
                {selectableChannels.length === 0 ? (
                  <option value="">No sync-compatible channels</option>
                ) : (
                  selectableChannels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.displayName}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {blockReason ? <p className="mt-3 text-xs text-token-expired">{blockReason}</p> : null}

          <div className="mt-4 space-y-2 rounded border border-border-default bg-app-surface p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.5px] text-text-tertiary">Element room</p>
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input
                type="radio"
                checked={roomMode === "create"}
                onChange={() => setRoomMode("create")}
              />
              Create new room
            </label>
            <input
              className="w-full rounded border border-border-default bg-app-content px-2 py-2 text-sm text-text-primary outline-none"
              placeholder="Room name (optional)"
              value={createRoomName}
              onChange={(event) => setCreateRoomName(event.target.value)}
              disabled={roomMode !== "create"}
            />

            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input
                type="radio"
                checked={roomMode === "existing"}
                onChange={() => setRoomMode("existing")}
              />
              Use existing room
            </label>
            <select
              className="w-full rounded border border-border-default bg-app-content px-2 py-2 text-sm text-text-primary outline-none"
              value={existingRoomId}
              onChange={(event) => setExistingRoomId(event.target.value)}
              disabled={roomMode !== "existing"}
            >
              <option value="">Select room...</option>
              {(matrixRoomsQuery.data ?? []).map((room) => (
                <option key={room.room_id} value={room.room_id}>
                  {room.name ?? room.room_id}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 space-y-2">
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={autoPinWidget}
                onChange={(event) => onAutoPinWidgetChange(event.target.checked)}
              />
              Pin file widget to new rooms automatically
            </label>
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={importHistory}
                onChange={(event) => setImportHistory(event.target.checked)}
              />
              Import last 50 messages as history
            </label>
          </div>

          {error ? <p className="mt-3 text-sm text-token-expired">{error}</p> : null}

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded border border-border-default px-3 py-1.5 text-sm text-text-secondary transition hover:bg-app-hover"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded bg-accent-primary px-3 py-1.5 text-sm text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
              onClick={() => {
                void handleSubmit();
              }}
              disabled={submitting || Boolean(blockReason)}
            >
              {submitting ? "Creating..." : "Create Mapping"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
