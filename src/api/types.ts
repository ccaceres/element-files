export interface GraphUser {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
}

export interface Team {
  id: string;
  displayName: string;
  description?: string;
}

export interface Channel {
  id: string;
  displayName: string;
  description?: string;
  source?: "teams-channel" | "drive-folder";
  folderId?: string;
  driveId?: string;
}

export interface DriveItem {
  id: string;
  name: string;
  size?: number;
  webUrl: string;
  lastModifiedDateTime: string;
  createdDateTime?: string;
  lastModifiedBy?: {
    user?: {
      displayName?: string;
      email?: string;
      id?: string;
    };
  };
  file?: {
    mimeType?: string;
  };
  folder?: {
    childCount: number;
  };
  parentReference?: {
    driveId?: string;
    id?: string;
    path?: string;
  };
  "@microsoft.graph.downloadUrl"?: string;
  listItem?: {
    fields: Record<string, unknown>;
  };
}

export interface FilesFolder {
  id: string;
  name: string;
  parentReference: {
    driveId: string;
  };
}

export interface GraphCollectionResponse<T> {
  value: T[];
}

export type ViewMode = "list" | "grid";
export type SortBy = "name" | "lastModifiedDateTime" | "size";
export type SortDirection = "asc" | "desc";

export interface NavigationPath {
  id: string;
  name: string;
}

export interface NavigationState {
  selectedTeam: Team | null;
  selectedChannel: Channel | null;
  driveId: string | null;
  currentFolderId: string | null;
  pathStack: NavigationPath[];
  viewMode: ViewMode;
  sortBy: SortBy;
  sortDirection: SortDirection;
  searchQuery: string;
}

export type TokenStatus = "valid" | "expiring" | "expired" | "none";

export interface TokenState {
  token: string | null;
  user: GraphUser | null;
  status: TokenStatus;
  setToken: (token: string) => Promise<boolean>;
  clearToken: () => void;
  revalidateToken: () => Promise<void>;
}

export interface GraphListItemFields {
  [key: string]: unknown;
}

