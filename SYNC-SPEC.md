# Teams Sync Feature — Addition to element-files

## Spec for Claude Code

---

## 1. What We're Adding

A new **Sync** feature tab in the existing element-files app that pulls Microsoft Teams channel messages into Element (Matrix) rooms in real-time. This runs alongside the existing Files tab — same app, same tokens, same widget.

**Current app**: Browse SPO files via Graph API using a pasted bearer token.
**Addition**: Read Teams messages via Graph API + write them into Matrix rooms via Matrix Client API.

The app becomes a **two-feature bridge widget**:

| Tab | Reads from | Writes to |
|-----|-----------|-----------|
| 📁 Files | Graph API (SPO) | Browser (display only) |
| 💬 Sync | Graph API (Teams messages) | Matrix Client API (posts into Element rooms) |

---

## 2. New Dependencies

Add to `package.json`:

```json
{
  "matrix-js-sdk": "^34.0.0"
}
```

No other new dependencies needed. Everything else (TanStack Query, Zustand, Radix, Tailwind) is already in the project.

---

## 3. Authentication — Dual Token

### 3.1 New: Matrix Token

The app now needs **two tokens**:

| Token | Source | Lifetime | Storage |
|-------|--------|----------|---------|
| Graph API Bearer | Graph Explorer (paste manually) | ~1 hour | `sessionStorage` |
| Matrix Access Token | Element Settings → Help & About → Access Token | Does not expire (until logout) | `sessionStorage` |

### 3.2 Updated Token Entry Screen

The `TokenEntryScreen.tsx` gains a second input field. Both tokens are required for Sync; only the Graph token is required for Files.

```
┌─────────────────────────────────────────────┐
│                                             │
│       🔑 Connect to ICC-LAB Services        │
│                                             │
│   Microsoft 365 Token: (required)           │
│   ┌───────────────────────────────────────┐ │
│   │ Paste Graph Explorer token...         │ │
│   └───────────────────────────────────────┘ │
│   → Get it from Graph Explorer [link]       │
│                                             │
│   Element Token: (required for Sync)        │
│   ┌───────────────────────────────────────┐ │
│   │ Paste Matrix access token...          │ │
│   └───────────────────────────────────────┘ │
│   → Get it from Element: Settings →        │
│     Help & About → Access Token             │
│                                             │
│            [ Connect ]                      │
│                                             │
│   Files browsing works with Graph token     │
│   alone. Sync requires both tokens.         │
│                                             │
└─────────────────────────────────────────────┘
```

### 3.3 Token Manager Updates

Extend `src/auth/token-manager.ts`:

```typescript
// New keys
const MATRIX_TOKEN_KEY = "matrix_access_token";
const MATRIX_HOMESERVER_KEY = "matrix_homeserver_url";

// New methods
export const matrixTokenManager = {
  getToken: (): string | null => sessionStorage.getItem(MATRIX_TOKEN_KEY),
  setToken: (token: string): void => sessionStorage.setItem(MATRIX_TOKEN_KEY, token),
  clearToken: (): void => sessionStorage.removeItem(MATRIX_TOKEN_KEY),

  getHomeserver: (): string => {
    return sessionStorage.getItem(MATRIX_HOMESERVER_KEY) || "https://matrix.bsdu.eu";
  },
  setHomeserver: (url: string): void => sessionStorage.setItem(MATRIX_HOMESERVER_KEY, url),
};
```

### 3.4 Matrix Token Validation

Validate via Matrix client API:

```typescript
const validateMatrixToken = async (
  homeserver: string,
  token: string
): Promise<{ valid: boolean; userId?: string }> => {
  try {
    const res = await fetch(`${homeserver}/_matrix/client/v3/account/whoami`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      return { valid: true, userId: data.user_id };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
};
```

### 3.5 Updated TokenContext

Extend `TokenContext.tsx` to manage both tokens:

```typescript
interface TokenState {
  // Existing Graph token fields
  token: string | null;
  user: GraphUser | null;
  status: "valid" | "expiring" | "expired" | "none";

  // New Matrix token fields
  matrixToken: string | null;
  matrixUserId: string | null;
  matrixStatus: "valid" | "none";
  matrixHomeserver: string;

  // Methods
  setToken: (token: string) => Promise<boolean>;
  clearToken: () => void;
  setMatrixToken: (token: string) => Promise<boolean>;
  clearMatrixToken: () => void;
}
```

---

## 4. New API Layer — Matrix Client

### 4.1 Matrix Client Wrapper

Create `src/api/matrix-client.ts`:

```typescript
import { matrixTokenManager } from "../auth/token-manager";

const getBaseUrl = () => matrixTokenManager.getHomeserver();

export class MatrixApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "MatrixApiError";
  }
}

export async function matrixFetch<T>(
  path: string,
  options?: {
    method?: string;
    body?: unknown;
    params?: Record<string, string>;
  }
): Promise<T> {
  const token = matrixTokenManager.getToken();
  if (!token) throw new MatrixApiError(401, "No Matrix token");

  const url = new URL(`${getBaseUrl()}${path}`);
  if (options?.params) {
    Object.entries(options.params).forEach(([k, v]) =>
      url.searchParams.set(k, v)
    );
  }

  const res = await fetch(url.toString(), {
    method: options?.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new MatrixApiError(res.status, err.error || res.statusText);
  }

  return res.json();
}
```

### 4.2 Matrix Room Operations

Create `src/api/matrix-rooms.ts`:

```typescript
import { matrixFetch } from "./matrix-client";

// Create a new room
export async function createRoom(options: {
  name: string;
  topic?: string;
  preset?: "private_chat" | "public_chat" | "trusted_private_chat";
}): Promise<{ room_id: string }> {
  return matrixFetch("/v3/createRoom", {
    method: "POST",
    body: {
      name: options.name,
      topic: options.topic || "",
      preset: options.preset || "private_chat",
      initial_state: [
        {
          type: "m.room.history_visibility",
          content: { history_visibility: "shared" },
        },
      ],
    },
  });
}

// Send a text message to a room
export async function sendMessage(
  roomId: string,
  body: string,
  formattedBody?: string
): Promise<{ event_id: string }> {
  const txnId = `m${Date.now()}.${Math.random().toString(36).slice(2)}`;
  return matrixFetch(
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`,
    {
      method: "PUT",
      body: {
        msgtype: "m.text",
        body,
        ...(formattedBody
          ? { format: "org.matrix.custom.html", formatted_body: formattedBody }
          : {}),
      },
    }
  );
}

// Send a notice (bot-style message, visually distinct)
export async function sendNotice(
  roomId: string,
  body: string,
  formattedBody?: string
): Promise<{ event_id: string }> {
  const txnId = `m${Date.now()}.${Math.random().toString(36).slice(2)}`;
  return matrixFetch(
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`,
    {
      method: "PUT",
      body: {
        msgtype: "m.notice",
        body,
        ...(formattedBody
          ? { format: "org.matrix.custom.html", formatted_body: formattedBody }
          : {}),
      },
    }
  );
}

// Get list of joined rooms
export async function getJoinedRooms(): Promise<{ joined_rooms: string[] }> {
  return matrixFetch("/_matrix/client/v3/joined_rooms");
}

// Get room name
export async function getRoomName(roomId: string): Promise<{ name: string }> {
  return matrixFetch(
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.name/`
  );
}

// Set room widget state event (pin widget to room)
export async function setWidgetInRoom(
  roomId: string,
  widgetId: string,
  widgetUrl: string,
  widgetName: string
): Promise<void> {
  await matrixFetch(
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/im.vector.modular.widgets/${widgetId}`,
    {
      method: "PUT",
      body: {
        type: "customwidget",
        url: widgetUrl,
        name: widgetName,
        id: widgetId,
        creatorUserId: matrixTokenManager.getToken(), // Will be overridden
      },
    }
  );
}
```

### 4.3 Teams Messages API

Create `src/api/messages.ts`:

```typescript
import { graphFetch } from "./graph-client";

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

interface MessagesResponse {
  value: TeamsMessage[];
  "@odata.nextLink"?: string;
}

// Get channel messages (newest first by default)
export async function getChannelMessages(
  teamId: string,
  channelId: string,
  top: number = 50
): Promise<MessagesResponse> {
  return graphFetch<MessagesResponse>(
    `/teams/${teamId}/channels/${channelId}/messages`,
    { $top: top.toString(), $orderby: "lastModifiedDateTime desc" }
  );
}

// Get messages newer than a specific datetime
export async function getNewChannelMessages(
  teamId: string,
  channelId: string,
  since: string // ISO 8601 datetime
): Promise<MessagesResponse> {
  return graphFetch<MessagesResponse>(
    `/teams/${teamId}/channels/${channelId}/messages/delta`,
    { $filter: `lastModifiedDateTime gt ${since}` }
  );
}

// Get message replies (threads)
export async function getMessageReplies(
  teamId: string,
  channelId: string,
  messageId: string
): Promise<MessagesResponse> {
  return graphFetch<MessagesResponse>(
    `/teams/${teamId}/channels/${channelId}/messages/${messageId}/replies`
  );
}
```

---

## 5. New State — Sync Store

Create `src/stores/sync-store.ts`:

```typescript
import { create } from "zustand";

interface ChannelMapping {
  teamId: string;
  teamName: string;
  channelId: string;
  channelName: string;
  matrixRoomId: string;
  lastSyncedMessageId: string | null;
  lastSyncedAt: string | null; // ISO datetime
  enabled: boolean;
}

interface SyncState {
  // Active tab
  activeTab: "files" | "sync";
  setActiveTab: (tab: "files" | "sync") => void;

  // Channel-to-room mappings
  mappings: ChannelMapping[];
  addMapping: (mapping: ChannelMapping) => void;
  removeMapping: (channelId: string) => void;
  updateMapping: (channelId: string, updates: Partial<ChannelMapping>) => void;

  // Sync status
  syncRunning: boolean;
  setSyncRunning: (running: boolean) => void;
  syncErrors: Record<string, string>; // channelId -> error message
  setSyncError: (channelId: string, error: string | null) => void;

  // Sync log (last N events for display)
  syncLog: SyncLogEntry[];
  addLogEntry: (entry: SyncLogEntry) => void;
  clearLog: () => void;

  // Polling interval
  pollIntervalSeconds: number;
  setPollInterval: (seconds: number) => void;

  // Auto-pin widget to new rooms
  autoPinWidget: boolean;
  setAutoPinWidget: (pin: boolean) => void;
}

interface SyncLogEntry {
  timestamp: string;
  channelName: string;
  messageCount: number;
  status: "success" | "error";
  error?: string;
}
```

Persist mappings to `sessionStorage` so they survive widget reloads within the session:

```typescript
// On every mapping change, persist
const persistMappings = (mappings: ChannelMapping[]) => {
  sessionStorage.setItem("sync_channel_mappings", JSON.stringify(mappings));
};

// On store init, hydrate from sessionStorage
const loadMappings = (): ChannelMapping[] => {
  const stored = sessionStorage.getItem("sync_channel_mappings");
  return stored ? JSON.parse(stored) : [];
};
```

---

## 6. New UI Components

### 6.1 Tab Bar

Add a tab bar to `AppShell.tsx`, between the toolbar and the content area:

```
┌─────────────────────────────────────────────────┐
│  Sidebar  │  Toolbar (breadcrumbs, search, etc) │
│           ├─────────────────────────────────────┤
│           │  [📁 Files]  [💬 Sync]              │
│           ├─────────────────────────────────────┤
│           │                                     │
│           │  Content area (switches by tab)      │
│           │                                     │
└───────────┴─────────────────────────────────────┘
```

- When **Files** tab is active: existing file browser behavior (unchanged)
- When **Sync** tab is active: sync dashboard (new)
- Tab state lives in `sync-store.activeTab`
- Toolbar adapts per tab (search hidden in Sync tab, replaced by sync controls)

### 6.2 Sync Dashboard

Create `src/components/sync/SyncDashboard.tsx`:

Main view when Sync tab is active. Three sections:

```
┌─────────────────────────────────────────────────┐
│  Sync Controls                                   │
│  [▶ Start Sync]  [⏸ Pause]  Poll: [30s ▾]      │
│  Status: Syncing... (last run: 30s ago)          │
├─────────────────────────────────────────────────┤
│  Channel Mappings                                │
│                                                  │
│  Team              Channel        Element Room   │
│  ─────────────────────────────────────────────── │
│  OTP-BSDU          General     → #BSDU-General  │
│  OTP-BSDU          Apps        → #BSDU-Apps     │
│  OTP-BSDU          Mission P.  → (not mapped)   │
│                                    [+ Create]    │
│                                                  │
│  [+ Add channel mapping]                         │
├─────────────────────────────────────────────────┤
│  Sync Log                                        │
│                                                  │
│  14:32  BSDU > General     3 messages  ✓         │
│  14:32  BSDU > Apps        0 messages  ✓         │
│  14:31  BSDU > General     1 message   ✓         │
│  14:30  BSDU > General     error: 401  ✗         │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 6.3 Channel Mapping Dialog

Create `src/components/sync/ChannelMappingDialog.tsx`:

Modal dialog for creating a new channel → room mapping:

```
┌─────────────────────────────────────────────┐
│  Map Teams Channel → Element Room            │
│                                             │
│  Team:    [OTP-BSDU          ▾]             │
│  Channel: [General           ▾]             │
│                                             │
│  Element Room:                              │
│  ○ Create new room: "BSDU - General"        │
│  ○ Use existing room: [select... ▾]         │
│                                             │
│  Options:                                   │
│  ☑ Pin file widget to room automatically    │
│  ☑ Import last 50 messages as history       │
│                                             │
│        [Cancel]     [Create Mapping]        │
└─────────────────────────────────────────────┘
```

- Team and Channel dropdowns use the same data as the Files sidebar (shared hooks)
- "Create new room" calls Matrix `createRoom` API
- "Use existing room" lists joined rooms from Matrix API
- Import option does a one-time backfill of recent messages

### 6.4 Sync Log Panel

Create `src/components/sync/SyncLog.tsx`:

Scrollable list of recent sync events. Each entry shows:
- Timestamp
- Channel name
- Number of messages synced
- Status icon (✓ green / ✗ red)
- Error message on hover if failed

Max 100 entries in memory, oldest dropped first.

---

## 7. Sync Engine

### 7.1 Core Sync Loop

Create `src/sync/sync-engine.ts`:

```typescript
import { getChannelMessages, TeamsMessage } from "../api/messages";
import { sendMessage, sendNotice } from "../api/matrix-rooms";
import { useSyncStore } from "../stores/sync-store";

class SyncEngine {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;

  start() {
    if (this.running) return;
    this.running = true;
    this.tick(); // Run immediately
    const interval = useSyncStore.getState().pollIntervalSeconds * 1000;
    this.intervalId = setInterval(() => this.tick(), interval);
    useSyncStore.getState().setSyncRunning(true);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
    this.running = false;
    useSyncStore.getState().setSyncRunning(false);
  }

  private async tick() {
    const { mappings, updateMapping, addLogEntry, setSyncError } =
      useSyncStore.getState();

    for (const mapping of mappings.filter((m) => m.enabled)) {
      try {
        const messages = await this.fetchNewMessages(mapping);
        if (messages.length > 0) {
          await this.postToMatrix(mapping, messages);
          // Update last synced
          const newest = messages[0];
          updateMapping(mapping.channelId, {
            lastSyncedMessageId: newest.id,
            lastSyncedAt: newest.createdDateTime,
          });
        }
        setSyncError(mapping.channelId, null);
        addLogEntry({
          timestamp: new Date().toISOString(),
          channelName: `${mapping.teamName} > ${mapping.channelName}`,
          messageCount: messages.length,
          status: "success",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setSyncError(mapping.channelId, msg);
        addLogEntry({
          timestamp: new Date().toISOString(),
          channelName: `${mapping.teamName} > ${mapping.channelName}`,
          messageCount: 0,
          status: "error",
          error: msg,
        });
      }
    }
  }

  private async fetchNewMessages(
    mapping: ChannelMapping
  ): Promise<TeamsMessage[]> {
    const response = await getChannelMessages(
      mapping.teamId,
      mapping.channelId,
      20
    );

    // Filter to only messages newer than last sync
    let messages = response.value.filter(
      (m) => m.messageType === "message" // Skip system events
    );

    if (mapping.lastSyncedAt) {
      messages = messages.filter(
        (m) => new Date(m.createdDateTime) > new Date(mapping.lastSyncedAt!)
      );
    }

    // Return oldest first (for posting in chronological order)
    return messages.reverse();
  }

  private async postToMatrix(
    mapping: ChannelMapping,
    messages: TeamsMessage[]
  ) {
    for (const msg of messages) {
      const sender = msg.from?.user?.displayName ||
        msg.from?.application?.displayName ||
        "Unknown";

      // Format as HTML for rich display
      const htmlBody = this.formatMessageHtml(sender, msg);
      const plainBody = this.formatMessagePlain(sender, msg);

      await sendMessage(mapping.matrixRoomId, plainBody, htmlBody);

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  private formatMessageHtml(sender: string, msg: TeamsMessage): string {
    const time = new Date(msg.createdDateTime).toLocaleTimeString();
    const content =
      msg.body.contentType === "html"
        ? msg.body.content
        : this.escapeHtml(msg.body.content);

    // Attachments
    let attachmentsHtml = "";
    if (msg.attachments?.length) {
      attachmentsHtml = msg.attachments
        .map((a) =>
          a.contentUrl
            ? `<br/>📎 <a href="${a.contentUrl}">${a.name || "attachment"}</a>`
            : `<br/>📎 ${a.name || "attachment"}`
        )
        .join("");
    }

    return `<strong>💬 ${this.escapeHtml(sender)}</strong> <em>(${time} via Teams)</em><br/>${content}${attachmentsHtml}`;
  }

  private formatMessagePlain(sender: string, msg: TeamsMessage): string {
    const time = new Date(msg.createdDateTime).toLocaleTimeString();
    const content =
      msg.body.contentType === "html"
        ? this.stripHtml(msg.body.content)
        : msg.body.content;

    let attachments = "";
    if (msg.attachments?.length) {
      attachments =
        "\n" +
        msg.attachments
          .map((a) => `📎 ${a.name || "attachment"}${a.contentUrl ? ": " + a.contentUrl : ""}`)
          .join("\n");
    }

    return `💬 ${sender} (${time} via Teams)\n${content}${attachments}`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "").trim();
  }
}

export const syncEngine = new SyncEngine();
```

### 7.2 Initial Backfill

When a new mapping is created with "Import last N messages" enabled:

```typescript
export async function backfillMessages(
  mapping: ChannelMapping,
  count: number = 50
): Promise<number> {
  const response = await getChannelMessages(
    mapping.teamId,
    mapping.channelId,
    count
  );

  const messages = response.value
    .filter((m) => m.messageType === "message")
    .reverse(); // Oldest first

  // Post a system notice first
  await sendNotice(
    mapping.matrixRoomId,
    `📋 Importing ${messages.length} messages from Teams channel "${mapping.channelName}"...`
  );

  for (const msg of messages) {
    const sender =
      msg.from?.user?.displayName ||
      msg.from?.application?.displayName ||
      "Unknown";
    const htmlBody = syncEngine.formatMessageHtml(sender, msg);
    const plainBody = syncEngine.formatMessagePlain(sender, msg);

    await sendMessage(mapping.matrixRoomId, plainBody, htmlBody);
    await new Promise((r) => setTimeout(r, 150)); // Rate limit
  }

  // Post completion notice
  await sendNotice(
    mapping.matrixRoomId,
    `✅ Imported ${messages.length} messages from Teams. Live sync is ${mapping.enabled ? "active" : "paused"}.`
  );

  return messages.length;
}
```

### 7.3 Deduplication

Messages are deduped by comparing `createdDateTime` against `lastSyncedAt` in the mapping. The sync engine only fetches the 20 most recent messages per tick and filters by timestamp.

For extra safety, the engine can also maintain a Set of recently synced message IDs in memory (last 200 IDs) to catch edge cases where timestamps overlap.

```typescript
// In SyncEngine class
private recentlySynced = new Map<string, Set<string>>(); // channelId -> Set<messageId>

private isAlreadySynced(channelId: string, messageId: string): boolean {
  return this.recentlySynced.get(channelId)?.has(messageId) ?? false;
}

private markSynced(channelId: string, messageId: string): void {
  if (!this.recentlySynced.has(channelId)) {
    this.recentlySynced.set(channelId, new Set());
  }
  const set = this.recentlySynced.get(channelId)!;
  set.add(messageId);
  // Cap at 200
  if (set.size > 200) {
    const first = set.values().next().value;
    set.delete(first);
  }
}
```

---

## 8. Auto-Room Setup

### 8.1 Bulk Create Rooms

Create `src/sync/room-setup.ts`:

A utility function available from the Sync Dashboard that auto-creates rooms for all channels in a selected team:

```typescript
export async function setupTeamRooms(
  teamId: string,
  teamName: string,
  channels: Channel[],
  options: {
    pinWidget: boolean;
    widgetUrl: string;
    backfillCount: number; // 0 = no backfill
  }
): Promise<ChannelMapping[]> {
  const mappings: ChannelMapping[] = [];

  for (const channel of channels) {
    // Create Matrix room
    const roomName = `${teamName} - ${channel.displayName}`;
    const { room_id } = await createRoom({
      name: roomName,
      topic: `Bridged from Teams: ${teamName} > ${channel.displayName}`,
      preset: "private_chat",
    });

    // Pin file widget if requested
    if (options.pinWidget) {
      await setWidgetInRoom(
        room_id,
        `files-widget-${channel.id}`,
        options.widgetUrl,
        "ICC-LAB Files"
      );
    }

    const mapping: ChannelMapping = {
      teamId,
      teamName,
      channelId: channel.id,
      channelName: channel.displayName,
      matrixRoomId: room_id,
      lastSyncedMessageId: null,
      lastSyncedAt: null,
      enabled: true,
    };

    mappings.push(mapping);

    // Brief pause between room creations
    await new Promise((r) => setTimeout(r, 500));
  }

  return mappings;
}
```

### 8.2 Quick Setup Button

In the Sync Dashboard, add a "Quick Setup" button that:

1. Shows team selection dropdown
2. User picks a team
3. App creates one Element room per channel
4. Pins the file widget to each room
5. Adds all mappings to the sync store
6. Optionally backfills last 50 messages per channel
7. Starts sync

---

## 9. Updated Project Structure

New and modified files (additions marked with `+`, modifications with `~`):

```
src/
├── auth/
│   ├── token-manager.ts          ~ (add matrixTokenManager)
│   ├── TokenContext.tsx           ~ (add matrix token state)
│   └── TokenEntryScreen.tsx      ~ (add matrix token input)
├── api/
│   ├── graph-client.ts             (unchanged)
│   ├── teams.ts                    (unchanged)
│   ├── files.ts                    (unchanged)
│   ├── types.ts                  ~ (add TeamsMessage types)
│   ├── messages.ts               + (Teams messages API)
│   ├── matrix-client.ts          + (Matrix API wrapper)
│   └── matrix-rooms.ts           + (Room CRUD + messaging)
├── sync/
│   ├── sync-engine.ts            + (polling loop + message posting)
│   └── room-setup.ts             + (bulk room creation)
├── stores/
│   ├── navigation-store.ts         (unchanged)
│   └── sync-store.ts             + (sync state + mappings + log)
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx          ~ (add tab bar)
│   │   ├── Sidebar.tsx             (unchanged)
│   │   ├── Toolbar.tsx           ~ (adapt per active tab)
│   │   └── TabBar.tsx            + (Files | Sync tabs)
│   ├── files/                      (all unchanged)
│   ├── sync/
│   │   ├── SyncDashboard.tsx     + (main sync view)
│   │   ├── ChannelMappings.tsx   + (mapping table)
│   │   ├── ChannelMappingDialog.tsx + (create/edit mapping)
│   │   ├── SyncControls.tsx      + (start/stop/interval)
│   │   ├── SyncLog.tsx           + (activity log)
│   │   └── QuickSetup.tsx        + (bulk room creation wizard)
│   ├── common/                     (unchanged)
│   └── theme/                      (unchanged)
├── hooks/
│   ├── useTeams.ts                 (unchanged, shared with sync)
│   ├── useChannels.ts              (unchanged, shared with sync)
│   ├── useFiles.ts                 (unchanged)
│   ├── useSearch.ts                (unchanged)
│   ├── useNavigation.ts            (unchanged)
│   ├── useMatrixRooms.ts        + (fetch joined rooms)
│   └── useSyncEngine.ts         + (hook to control sync lifecycle)
└── types/
    └── index.ts                  ~ (add sync-related types)
```

---

## 10. Message Formatting in Element

Teams messages posted into Element should be visually distinct so users know they came from Teams. Format:

**In Element, a synced message appears as:**

```
💬 Chris Liew (14:32 via Teams)
Hey Carlos, can you review the Mission Planning RACI before Friday?

📎 MP-RACI.xlsx
```

Using Matrix HTML formatting:

```html
<strong>💬 Chris Liew</strong> <em>(14:32 via Teams)</em><br/>
Hey Carlos, can you review the Mission Planning RACI before Friday?<br/>
<br/>
📎 <a href="https://...">MP-RACI.xlsx</a>
```

This preserves:
- Who sent it (Teams display name)
- When (original Teams timestamp)
- Source indicator ("via Teams")
- Attachments with links
- HTML formatting from Teams messages

---

## 11. Graph API Permissions Note

The Teams channel messages endpoint (`/teams/{id}/channels/{id}/messages`) requires the `ChannelMessage.Read.All` permission in the Graph Explorer token. The user should consent to this scope when signing into Graph Explorer.

Required Graph Explorer consent scopes (tell user to check these in Graph Explorer):
- `User.Read` (already needed for Files)
- `Team.ReadBasic.All` (already needed for Files)
- `Channel.ReadBasic.All` (already needed for Files)
- `Files.Read.All` (already needed for Files)
- `ChannelMessage.Read.All` ← **NEW for Sync**

---

## 12. Error Handling

### 12.1 Sync-Specific Errors

| Error | Handling |
|-------|---------|
| Graph 401 | Stop sync, show token expired overlay |
| Graph 403 on messages | Mark channel as "no access" in mapping, skip, log |
| Matrix 401 | Stop sync, prompt for new Matrix token |
| Matrix 429 (rate limit) | Back off, retry after `Retry-After` header |
| Network error | Log, retry on next tick |

### 12.2 Rate Limiting

Matrix homeservers rate-limit message sends. The sync engine includes:
- 200ms delay between messages within a batch
- 500ms delay between room creations
- Exponential backoff on 429 responses (1s, 2s, 4s, max 30s)

---

## 13. Behavior Requirements

### 13.1 Sync Lifecycle
1. User opens Sync tab
2. Creates channel-to-room mappings (manual or Quick Setup)
3. Clicks "Start Sync"
4. Engine polls every N seconds (configurable, default 30)
5. New Teams messages appear in mapped Element rooms
6. Sync pauses when widget is closed/tab switches (optional: keep running)
7. On token expiry → sync stops, user re-enters Graph token, sync resumes

### 13.2 Important: Sync only runs while the widget is open
Since this is a client-side app with no backend, sync only happens when:
- The Element room with the widget is open
- The browser tab is active (or at least not suspended)

This is a known limitation. For always-on sync, a server-side component would be needed (Phase 2).

### 13.3 Files Tab Unchanged
The Files tab continues to work exactly as before. The Sync feature is purely additive. If the user never enters a Matrix token, the Sync tab shows a prompt to add one but everything else works.

---

## 14. Summary for Claude Code

**Add to the existing element-files project:**

1. **Dual token auth**: Add Matrix access token input alongside the existing Graph token. Validate via `/_matrix/client/v3/account/whoami`. Store in sessionStorage.

2. **Tab bar**: Add Files | Sync tabs in AppShell. Files tab is the existing behavior (untouched). Sync tab shows the new dashboard.

3. **Sync Dashboard UI**: Channel mapping table, sync controls (start/stop/interval), activity log, quick setup wizard.

4. **Channel Mapping Dialog**: Select team + channel → create or select Element room → save mapping.

5. **Matrix API layer**: `matrix-client.ts` wrapper (like `graph-client.ts` but for Matrix), `matrix-rooms.ts` for room operations and message sending.

6. **Teams Messages API**: `messages.ts` for fetching channel messages via Graph.

7. **Sync Engine**: Polling loop that reads Teams messages and posts them to mapped Matrix rooms with formatted HTML. Deduplication by timestamp + message ID. Rate limit aware.

8. **Room auto-setup**: Bulk create Element rooms from Teams channels with auto-pin of file widget.

9. **Error handling**: Graceful handling of expired tokens (both Graph and Matrix), 403s, rate limits, and network errors.

The existing Files functionality must remain completely unchanged. Sync is a new additive feature.
