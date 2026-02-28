import { graphFetch, graphFetchBlob } from "@/api/graph-client";
import type {
  DriveItem,
  FilesFolder,
  GraphCollectionResponse,
  GraphListItemFields,
} from "@/api/types";

const FOLDER_SELECT =
  "id,name,size,lastModifiedDateTime,lastModifiedBy,file,folder,webUrl,parentReference";

export async function getChannelFilesFolder(
  teamId: string,
  channelId: string,
): Promise<FilesFolder> {
  return graphFetch<FilesFolder>(`/teams/${teamId}/channels/${channelId}/filesFolder`);
}

export async function getFolderChildren(
  driveId: string,
  itemId: string,
): Promise<DriveItem[]> {
  const response = await graphFetch<GraphCollectionResponse<DriveItem>>(
    `/drives/${driveId}/items/${itemId}/children`,
    {
      "$select": FOLDER_SELECT,
      "$orderby": "name",
      "$top": "200",
    },
  );

  return response.value;
}

function escapeSearchQuery(query: string): string {
  return query.replaceAll("'", "''");
}

export async function searchDrive(driveId: string, query: string): Promise<DriveItem[]> {
  const escaped = escapeSearchQuery(query);
  const path = `/drives/${driveId}/root/search(q='${escaped}')`;

  const response = await graphFetch<GraphCollectionResponse<DriveItem>>(path, {
    "$select": FOLDER_SELECT,
    "$top": "200",
  });

  return response.value;
}

export async function getItemFields(
  driveId: string,
  itemId: string,
): Promise<GraphListItemFields | null> {
  try {
    return await graphFetch<GraphListItemFields>(
      `/drives/${driveId}/items/${itemId}/listItem/fields`,
    );
  } catch {
    return null;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Unable to convert thumbnail to data URL"));
    };
    reader.onerror = () => {
      reject(new Error("Unable to read thumbnail"));
    };
    reader.readAsDataURL(blob);
  });
}

export async function getThumbnailUrl(
  driveId: string,
  itemId: string,
): Promise<string | null> {
  try {
    const blob = await graphFetchBlob(
      `/drives/${driveId}/items/${itemId}/thumbnails/0/medium/content`,
    );
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

