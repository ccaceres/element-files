import { GraphApiError, graphFetch, graphFetchBlob, GRAPH_BASE } from "@/api/graph-client";
import type { Channel, GraphCollectionResponse, GraphUser, Team } from "@/api/types";

export async function validateToken(
  token: string,
): Promise<{ valid: boolean; user?: GraphUser }> {
  try {
    const res = await fetch(`${GRAPH_BASE}/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      return { valid: false };
    }

    const user = (await res.json()) as GraphUser;
    return { valid: true, user };
  } catch {
    return { valid: false };
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

