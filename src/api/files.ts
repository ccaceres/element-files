import { graphFetch, graphFetchBlob } from "@/api/graph-client";
import type {
  DriveItem,
  FilesFolder,
  GraphCollectionResponse,
  GraphListItemFields,
} from "@/api/types";

const FOLDER_SELECT =
  "id,name,size,lastModifiedDateTime,lastModifiedBy,file,folder,webUrl,parentReference";

interface GraphPagedCollectionResponse<T> extends GraphCollectionResponse<T> {
  "@odata.nextLink"?: string;
}

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

async function getFolderChildrenPaged(
  driveId: string,
  itemId: string,
): Promise<DriveItem[]> {
  const allItems: DriveItem[] = [];
  let nextPath: string | null = `/drives/${driveId}/items/${itemId}/children`;
  let params: Record<string, string> | undefined = {
    "$select": FOLDER_SELECT,
    "$orderby": "name",
    "$top": "200",
  };

  while (nextPath) {
    const response: GraphPagedCollectionResponse<DriveItem> = await graphFetch(
      nextPath,
      params,
    );

    allItems.push(...response.value);
    nextPath = response["@odata.nextLink"] ?? null;
    params = undefined;
  }

  return allItems;
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

interface DownloadLinkResponse {
  "@microsoft.graph.downloadUrl"?: string;
}

export async function getFileContentBlob(
  driveId: string,
  itemId: string,
): Promise<Blob> {
  try {
    const response = await graphFetch<DownloadLinkResponse>(
      `/drives/${driveId}/items/${itemId}`,
      {
        "$select": "id,name,@microsoft.graph.downloadUrl",
      },
    );

    const downloadUrl = response["@microsoft.graph.downloadUrl"];
    if (downloadUrl) {
      const fileResponse = await fetch(downloadUrl);
      if (fileResponse.ok) {
        return fileResponse.blob();
      }
    }
  } catch {
    // Fallback to Graph content endpoint below.
  }

  return graphFetchBlob(`/drives/${driveId}/items/${itemId}/content`);
}

export interface DriveTreeFile {
  id: string;
  name: string;
  path: string;
  size: number;
  lastModifiedDateTime: string;
  mimeType: string;
  webUrl: string;
}

export async function listFolderTree(
  driveId: string,
  rootFolderId: string,
): Promise<DriveTreeFile[]> {
  const files: DriveTreeFile[] = [];
  const queue: Array<{ folderId: string; basePath: string }> = [
    { folderId: rootFolderId, basePath: "" },
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const children = await getFolderChildrenPaged(driveId, current.folderId);
    children.sort((left, right) => left.name.localeCompare(right.name));

    for (const child of children) {
      const nextPath = `${current.basePath}/${child.name}`;
      if (child.folder) {
        queue.push({ folderId: child.id, basePath: nextPath });
        continue;
      }

      if (!child.file) {
        continue;
      }

      files.push({
        id: child.id,
        name: child.name,
        path: nextPath,
        size: child.size ?? 0,
        lastModifiedDateTime: child.lastModifiedDateTime,
        mimeType: child.file.mimeType ?? "application/octet-stream",
        webUrl: child.webUrl,
      });
    }
  }

  files.sort((left, right) => left.path.localeCompare(right.path));
  return files;
}

