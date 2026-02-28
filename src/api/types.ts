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

export type ChannelSource = "teams-channel" | "drive-folder";

export interface Channel {
  id: string;
  displayName: string;
  description?: string;
  source?: ChannelSource;
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
export type MatrixTokenStatus = "valid" | "none";

export interface TokenState {
  token: string | null;
  user: GraphUser | null;
  status: TokenStatus;

  matrixToken: string | null;
  matrixUserId: string | null;
  matrixStatus: MatrixTokenStatus;
  matrixHomeserver: string;

  setToken: (token: string) => Promise<boolean>;
  clearToken: () => void;
  revalidateToken: () => Promise<void>;

  setMatrixToken: (token: string, homeserver?: string) => Promise<boolean>;
  clearMatrixToken: () => void;
}

export interface GraphListItemFields {
  [key: string]: unknown;
}

export interface TeamsMessage {
  id: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  messageType: "message" | "systemEventMessage";
  body: {
    contentType: "text" | "html";
    content: string;
  };
  from?: {
    user?: {
      id: string;
      displayName: string;
    };
    application?: {
      displayName: string;
    };
  };
  attachments?: Array<{
    id: string;
    contentType: string;
    contentUrl?: string;
    name?: string;
  }>;
  reactions?: Array<{
    reactionType: string;
    user: {
      user: {
        id: string;
        displayName: string;
      };
    };
  }>;
}

export interface TeamsMessagesResponse {
  value: TeamsMessage[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
}

export interface MatrixRoom {
  room_id: string;
  name?: string;
}

export interface MatrixJoinedRoomsResponse {
  joined_rooms: string[];
}

export interface ChannelMapping {
  teamId: string;
  teamName: string;
  channelId: string;
  channelName: string;
  matrixRoomId: string;
  lastSyncedMessageId: string | null;
  lastSyncedAt: string | null;
  enabled: boolean;
}

export type SyncTab = "files" | "sync";

export interface SyncLogEntry {
  timestamp: string;
  channelName: string;
  messageCount: number;
  status: "success" | "error";
  error?: string;
}

export type SyncStatus = "idle" | "running" | "paused" | "error";
