# ICC-LAB Files + Sync App Architecture

## 1. Overview

This is a client-only widget app with two runtime features:

- `Files`: browse Teams/SharePoint files via Microsoft Graph.
- `Sync`: bridge Teams channel messages into Matrix rooms.

There is no backend. All API calls are browser-side with manually pasted tokens stored in `sessionStorage`.

## 2. Runtime Model

- `src/main.tsx` bootstraps React Query + `TokenProvider`.
- `src/App.tsx` handles auth gates:
  - no Graph token/user -> full-screen token entry
  - Graph expired -> forced re-auth
  - authenticated -> `AppShell`
- `src/components/layout/AppShell.tsx` is the composition root:
  - shared sidebar and toolbar
  - `Files | Sync` tab switch
  - Files content and Details panel
  - Sync dashboard

## 3. Authentication Architecture

### 3.1 Token storage

`src/auth/token-manager.ts` stores and manages:

- Graph:
  - `graph_bearer_token`
  - `graph_token_timestamp`
- Matrix:
  - `matrix_access_token`
  - `matrix_homeserver_url`

Both managers expose set/get/clear methods and event subscriptions for reactive UI state.

### 3.2 Token context

`src/auth/TokenContext.tsx` owns session state:

- Graph: `token`, `user`, `status` (`valid | expiring | expired | none`)
- Matrix: `matrixToken`, `matrixUserId`, `matrixStatus`, `matrixHomeserver`

Validation flows:

- Graph token validation: `GET /me`
- Matrix token validation: `GET /_matrix/client/v3/account/whoami`

401 behavior:

- Graph 401 -> Graph token cleared, `status=expired`, re-auth overlay.
- Matrix 401 -> Matrix token cleared, sync stops, UI shows Matrix missing.

### 3.3 Token UI

`src/auth/TokenEntryScreen.tsx` supports:

- required Graph token
- optional Matrix token + homeserver
- clear “Files only” behavior when Matrix token is omitted

## 4. API Layer

### 4.1 Graph APIs

- `src/api/graph-client.ts`: typed Graph wrapper with auth headers and 401 interception.
- `src/api/teams.ts`: `/me`, joined teams, channels, photo.
  - channel fallback on 403 to group drive folders for Files-only browsing.
- `src/api/files.ts`: channel folder resolution, children, search, metadata, thumbnails.
- `src/api/messages.ts`: Teams messages and replies endpoints for Sync.

### 4.2 Matrix APIs

- `src/api/matrix-client.ts`: `matrixFetch` wrapper + `MatrixApiError`.
  - supports `Retry-After` parsing for 429 backoff.
- `src/api/matrix-rooms.ts`:
  - room creation
  - `m.text`/`m.notice` sending
  - joined-room listing + room name lookup
  - widget state event pinning

## 5. State Model

### 5.1 Navigation/UI state

`src/stores/navigation-store.ts` (Zustand) handles Files navigation:

- selected team/channel
- drive/folder context
- breadcrumb stack
- view mode, sort, search
- selection/details panel
- sidebar collapse (iframe-aware default)

### 5.2 Sync state

`src/stores/sync-store.ts` (Zustand) handles:

- `activeTab` (`files | sync`)
- channel mappings CRUD
- engine state (`syncRunning`)
- per-channel error map
- sync log ring buffer (max 100)
- poll interval
- auto-pin option

Persisted session keys:

- `sync_channel_mappings`
- `sync_poll_interval_seconds`
- `sync_auto_pin_widget`

## 6. Query and Hook Layer

Shared files hooks:

- `useTeams`, `useChannels`, `useFiles`, `useSearch`, `useNavigation`

Sync hooks:

- `useMatrixRooms`: resolves joined rooms + names.
- `useSyncEngine`: start/stop/restart lifecycle tied to:
  - active tab
  - token availability
  - poll interval changes

## 7. UI Composition

### 7.1 Shared layout

- `Sidebar`: user profile, teams/channels, sign out.
- `Toolbar`: per-tab controls.
  - Files tab: breadcrumbs/search/view/sort/refresh.
  - Sync tab: sync status summary.
- `TabBar`: `Files` and `Sync`.

### 7.2 Files UI

Unchanged browsing experience:

- list/grid rendering
- context menu actions
- details panel metadata/thumbnails
- folder navigation + search mode

### 7.3 Sync UI

`src/components/sync` provides:

- `SyncDashboard`: top-level Sync view
- `SyncControls`: start/pause + poll interval
- `ChannelMappings`: mapping table and enable/disable/remove
- `ChannelMappingDialog`: map team channel -> room (create or existing)
- `QuickSetup`: bulk room creation + mapping + optional start
- `SyncLog`: activity trail

Sync channel selection is intentionally restricted to `source === "teams-channel"`.
If Graph channel API is blocked and only folder-derived channels are available, Sync is blocked for that team.

## 8. Sync Engine

`src/sync/sync-engine.ts` is a singleton polling engine:

- poll interval from store (default 30s)
- per-tick behavior:
  - iterate enabled mappings
  - fetch latest Teams messages (`top=20`)
  - keep top-level `messageType === "message"` only
  - filter by `lastSyncedAt`
  - dedupe via recent message ID set (200/channel)
  - post oldest -> newest to Matrix
- rate limiting:
  - base 200ms inter-message delay
  - 429 retry/backoff using `Retry-After` or exponential fallback (max 30s)
- failures:
  - Graph 401 -> stop sync + expire Graph auth
  - Matrix 401 -> stop sync + clear Matrix token
  - Graph 403 or network -> channel-level error + continue other mappings

### 8.1 Message formatting

Each Matrix post includes:

- sender display name
- Teams timestamp
- source marker (`via Teams`)
- attachment names and links

Both plain text and HTML bodies are emitted.

### 8.2 Room setup and backfill

`src/sync/room-setup.ts`:

- `setupTeamRooms(...)` bulk-creates private rooms and optional widget pins.
- `backfillMessages(...)` imports historical messages with begin/end notices.

## 9. Lifecycle Behavior

- Sync runs only while `Sync` tab is active.
- Switching to `Files` pauses engine execution.
- Returning to `Sync` resumes when `syncRunning` is true.
- Files workflows continue without Matrix token.

## 10. Error Handling and UX

- Error mapping for Graph permission/not-found/network states in files flows.
- Sync keeps per-channel error state and logs without crashing entire loop.
- Token expiry states surface via overlays and status badges.

## 11. Testing and Verification

Current automated coverage includes:

- token managers (Graph + Matrix)
- Graph and Matrix API wrappers
- sync store persistence/log capping
- sync message formatting
- search debounce
- token entry behavior
- file action/details fallbacks

Validation commands:

- `npm run lint`
- `npm run test:run`
- `npm run build`
