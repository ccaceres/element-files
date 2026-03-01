import { GraphApiError, graphFetch, graphFetchBlob, GRAPH_BASE } from "@/api/graph-client";
import type { Channel, CloneRoot, FilesFolder, GraphCollectionResponse, GraphUser, Team } from "@/api/types";

export async function validateToken(
  token: string,
): Promise<{ valid: boolean; user?: GraphUser; status?: number; message?: string }> {
  try {
    const res = await fetch(`${GRAPH_BASE}/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      let message = bodyText || `Graph API returned ${res.status}`;

      try {
        const parsed = JSON.parse(bodyText) as { error?: { message?: string } };
        message = parsed.error?.message || message;
      } catch {
        // Keep raw body text when not JSON.
      }

      return { valid: false, status: res.status, message };
    }

    const user = (await res.json()) as GraphUser;
    return { valid: true, user };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    return { valid: false, message };
  }
}

export async function getMe(): Promise<GraphUser> {
  return graphFetch<GraphUser>("/me");
}

export async function getJoinedTeams(): Promise<Team[]> {
  const response = await graphFetch<GraphCollectionResponse<Team>>("/me/joinedTeams");
  return response.value;
}

export async function getTeamChannels(teamId: string): Promise<Channel[]> {
  try {
    const response = await graphFetch<GraphCollectionResponse<Channel>>(
      `/teams/${teamId}/channels`,
    );

    return sortChannels(
      response.value.map((channel) => ({
        ...channel,
        source: "teams-channel",
      })),
    );
  } catch (error) {
    if (error instanceof GraphApiError && error.status === 403) {
      const fallbackChannels = await getTeamChannelsFromDriveFolders(teamId);
      if (fallbackChannels.length > 0) {
        return fallbackChannels;
      }
    }

    throw error;
  }
}

async function getTeamsChannelFilesFolder(
  teamId: string,
  channelId: string,
): Promise<FilesFolder> {
  return graphFetch<FilesFolder>(`/teams/${teamId}/channels/${channelId}/filesFolder`);
}

interface GroupDrive {
  id: string;
}

interface RootDriveItem {
  id: string;
  name: string;
  folder?: {
    childCount: number;
  };
}

function sortChannels(channels: Channel[]): Channel[] {
  const sorted = [...channels];
  sorted.sort((a, b) => {
    if (a.displayName.toLowerCase() === "general") {
      return -1;
    }
    if (b.displayName.toLowerCase() === "general") {
      return 1;
    }
    return a.displayName.localeCompare(b.displayName);
  });
  return sorted;
}

async function getTeamChannelsFromDriveFolders(teamId: string): Promise<Channel[]> {
  const drive = await graphFetch<GroupDrive>(`/groups/${teamId}/drive`);
  const children = await graphFetch<GraphCollectionResponse<RootDriveItem>>(
    `/groups/${teamId}/drive/root/children`,
    {
      "$select": "id,name,folder",
      "$orderby": "name",
      "$top": "200",
    },
  );

  const folders = children.value.filter(
    (item) => Boolean(item.folder) && item.name.toLowerCase() !== "forms",
  );
  return sortChannels(
    folders.map((folder) => ({
      id: `folder:${folder.id}`,
      displayName: folder.name,
      source: "drive-folder",
      folderId: folder.id,
      driveId: drive.id,
    })),
  );
}

export async function resolveCloneRoots(teamId: string): Promise<CloneRoot[]> {
  const channels = await getTeamChannels(teamId);
  const roots: CloneRoot[] = [];

  for (const channel of channels) {
    if (channel.source === "drive-folder" && channel.driveId && channel.folderId) {
      roots.push({
        teamId,
        channelId: channel.id,
        channelLabel: channel.displayName,
        source: "drive-folder",
        driveId: channel.driveId,
        rootFolderId: channel.folderId,
      });
      continue;
    }

    if (channel.source === "teams-channel") {
      try {
        const filesFolder = await getTeamsChannelFilesFolder(teamId, channel.id);
        roots.push({
          teamId,
          channelId: channel.id,
          channelLabel: channel.displayName,
          source: "teams-channel",
          driveId: filesFolder.parentReference.driveId,
          rootFolderId: filesFolder.id,
        });
      } catch {
        // Skip channels whose files folder is not accessible.
      }
    }
  }

  const deduped = new Map<string, CloneRoot>();
  for (const root of roots) {
    const key = `${root.teamId}:${root.channelId}:${root.source}`;
    if (!deduped.has(key)) {
      deduped.set(key, root);
    }
  }

  return [...deduped.values()].sort((a, b) => {
    const aGeneral = a.channelLabel.toLowerCase() === "general";
    const bGeneral = b.channelLabel.toLowerCase() === "general";
    if (aGeneral && !bGeneral) {
      return -1;
    }
    if (!aGeneral && bGeneral) {
      return 1;
    }

    const byLabel = a.channelLabel.localeCompare(b.channelLabel);
    if (byLabel !== 0) {
      return byLabel;
    }

    if (a.source === b.source) {
      return 0;
    }
    return a.source === "teams-channel" ? -1 : 1;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Unable to convert user photo to data URL"));
    };
    reader.onerror = () => {
      reject(new Error("Unable to read user photo"));
    };
    reader.readAsDataURL(blob);
  });
}

export async function getUserPhotoDataUrl(userId: string): Promise<string | null> {
  try {
    const blob = await graphFetchBlob(`/users/${userId}/photo/$value`);
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

