# ICC-LAB Teams File Browser Widget for Element

## Project Spec — Hand to Claude Code

---

## 1. What We're Building

A React web app that runs inside Element (Matrix chat client) as an embedded widget. It connects to Microsoft Graph API using a manually-provided bearer token and displays the user's Teams files/folders with a UI that looks and feels exactly like Microsoft Teams' "Files" tab — but better.

**Key principle**: No files are copied or synced. The widget reads directly from SharePoint Online via Graph API in real-time. It's a window into Teams files, embedded inside Element.

**Auth constraint**: We do NOT have access to Azure AD app registration. Authentication is handled by the user pasting a bearer token obtained from Microsoft Graph Explorer (https://developer.microsoft.com/en-us/graph/graph-explorer). The token expires every ~1 hour and must be re-pasted.

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18+ with Vite |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Auth | Manual bearer token (no MSAL, no Azure AD app) |
| API | Microsoft Graph API v1.0 |
| Icons | Fluent UI Icons (@fluentui/react-icons) or custom SVG |
| Deployment | Static build → nginx container on vm-icc-lab-matrix |
| Domain | https://files.bsdu.eu |

---

## 3. Authentication — Bearer Token Flow

### 3.1 How It Works

There is **NO OAuth flow, NO MSAL, NO Azure AD app registration**. The user provides a Graph API bearer token manually.

**Where the user gets the token:**
1. Go to https://developer.microsoft.com/en-us/graph/graph-explorer
2. Sign in with their Microsoft account
3. Click on the "Access token" tab
4. Copy the full token string

**In the widget:**
1. App loads → checks `sessionStorage` for a saved token
2. If no token → show Token Entry Screen
3. User pastes their bearer token → app validates it by calling `GET /me`
4. If valid → store in `sessionStorage`, proceed to file browser
5. If invalid or expired → show error, ask for a new token
6. Token status indicator always visible in the toolbar (green = valid, red = expired)

### 3.2 Token Management

```typescript
// auth/token-manager.ts

const TOKEN_KEY = "graph_bearer_token";
const TOKEN_TIMESTAMP_KEY = "graph_token_timestamp";

export const tokenManager = {
  getToken: (): string | null => {
    return sessionStorage.getItem(TOKEN_KEY);
  },

  setToken: (token: string): void => {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(TOKEN_TIMESTAMP_KEY, Date.now().toString());
  },

  clearToken: (): void => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_TIMESTAMP_KEY);
  },

  getTokenAge: (): number => {
    const ts = sessionStorage.getItem(TOKEN_TIMESTAMP_KEY);
    if (!ts) return Infinity;
    return Date.now() - parseInt(ts);
  },

  // Graph Explorer tokens expire after ~1 hour
  isLikelyExpired: (): boolean => {
    return tokenManager.getTokenAge() > 55 * 60 * 1000; // 55 min warning
  },
};
```

### 3.3 Token Validation

On token entry, the app makes a test call:

```typescript
// Validate token by calling /me
const validateToken = async (token: string): Promise<{ valid: boolean; user?: GraphUser }> => {
  try {
    const res = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const user = await res.json();
      return { valid: true, user };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
};
```

### 3.4 Token Expiry Handling

- **55-minute warning**: Show amber badge "Token expiring soon — click to refresh"
- **On 401 response from any API call**: Show modal "Token expired — paste a new one"
- **Auto-intercept**: The Graph API client wrapper should catch 401s globally and trigger the re-auth flow

### 3.5 Token Entry Screen

A clean, focused screen shown when no token is present:

```
┌─────────────────────────────────────────────┐
│                                             │
│         🔑 Connect to Microsoft 365         │
│                                             │
│  1. Open Graph Explorer                     │
│     [link: https://developer.microsoft.com  │
│      /en-us/graph/graph-explorer]           │
│                                             │
│  2. Sign in with your ICC account           │
│                                             │
│  3. Copy your Access Token                  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ Paste your bearer token here...       │  │
│  │                                       │  │
│  └───────────────────────────────────────┘  │
│                                             │
│            [ Connect ]                      │
│                                             │
│  Token is stored in your browser session    │
│  only and never sent to our servers.        │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 4. Graph API Endpoints Used

All calls use the header: `Authorization: Bearer <token>`

### 4.1 Validate Token + Get User Info
```
GET https://graph.microsoft.com/v1.0/me
→ { id, displayName, mail, userPrincipalName }
```

### 4.2 List User's Teams
```
GET https://graph.microsoft.com/v1.0/me/joinedTeams
→ { value: [{ id, displayName, description }] }
```

### 4.3 List Team Channels
```
GET https://graph.microsoft.com/v1.0/teams/{team-id}/channels
→ { value: [{ id, displayName, description }] }
```

### 4.4 Get Channel Files Folder (root drive item)
```
GET https://graph.microsoft.com/v1.0/teams/{team-id}/channels/{channel-id}/filesFolder
→ { id, name, parentReference: { driveId } }
```
This returns the `driveId` and root `itemId` — needed for all file operations.

### 4.5 List Files/Folders in a Directory
```
GET https://graph.microsoft.com/v1.0/drives/{drive-id}/items/{item-id}/children
    ?$select=id,name,size,lastModifiedDateTime,lastModifiedBy,file,folder,webUrl
    &$orderby=name
    &$top=200
→ { value: [{ id, name, size, folder: {childCount}, file: {mimeType}, ... }] }
```

**Important**: `@microsoft.graph.downloadUrl` is automatically included in the response for files. This is a pre-authenticated URL valid for ~1 hour that can be used to download the file directly without additional auth.

### 4.6 Get File Thumbnail/Preview
```
GET https://graph.microsoft.com/v1.0/drives/{drive-id}/items/{item-id}/thumbnails/0/medium/content
→ binary image (for preview panel)
```

### 4.7 Download File
Use the `@microsoft.graph.downloadUrl` from the children listing. It's a pre-authenticated URL — just open in new tab or trigger browser download. No additional auth needed.

Alternatively:
```
GET https://graph.microsoft.com/v1.0/drives/{drive-id}/items/{item-id}/content
→ 302 redirect to download URL
```

### 4.8 Get SharePoint List Item Fields (custom columns)
```
GET https://graph.microsoft.com/v1.0/drives/{drive-id}/items/{item-id}/listItem/fields
→ { Source, Year, Category, OTP_x0020_logo, Update_x0020_Date, ... }
```
**Note**: SPO column names with spaces are encoded (e.g., "OTP logo" → "OTP_x0020_logo"). The widget should display them with clean names.

### 4.9 Search Files in a Drive
```
GET https://graph.microsoft.com/v1.0/drives/{drive-id}/root/search(q='{query}')
→ { value: [{ id, name, ... }] }
```

### 4.10 Get User Photo (for avatars)
```
GET https://graph.microsoft.com/v1.0/users/{user-id}/photo/$value
→ binary image
```
Wrap in try/catch — not all users have photos. Fall back to initials avatar.

---

## 5. UI Specification

### 5.1 Overall Layout

The app has a **3-panel layout** inspired by Teams but with a cleaner, more modern aesthetic:

```
┌─────────────────────────────────────────────────────┐
│ ┌───────────┐ ┌─────────────────────────────────┐   │
│ │           │ │  Toolbar / Breadcrumbs    [🔑🟢] │   │
│ │  Sidebar  │ ├─────────────────────────────────┤   │
│ │           │ │                                   │  │
│ │  Teams    │ │  File List                        │  │
│ │  list     │ │  (table view or grid view)        │  │
│ │           │ │                                   │  │
│ │  Channels │ │                                   │  │
│ │  list     │ │                                   │  │
│ │           │ │                                   │  │
│ └───────────┘ └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

The `[🔑🟢]` in the toolbar is the token status indicator.

When embedded in Element as a widget, the sidebar can be collapsed to save space.

### 5.2 Sidebar (Left Panel — ~240px)

- **Header**: App title with user avatar + name (from `/me` call) and a sign-out button (clears token)
- **Teams list**: Shows all teams the user is a member of
  - Each team: colored circle with initials + team name
  - Click to expand → shows channels
  - Active team highlighted with accent color
- **Channels list** (nested under selected team):
  - Channel icon + name
  - Click to navigate to that channel's files
  - "General" is always first
- **Collapsible**: Hamburger icon to toggle sidebar (important for Element widget mode)

### 5.3 Toolbar (Top Bar)

- **Breadcrumb navigation**: `BSDU > General > 03 Annual Workplans > 2026`
  - Each segment is clickable to navigate up
  - Root shows the team + channel name
- **Search bar**: Input field with search icon, searches files in current drive
- **View toggle**: List view (default) / Grid view icons
- **Sort dropdown**: Name, Modified date, Size
- **Refresh button**: Re-fetches current directory
- **Token status**: Small key icon — green (valid), amber (expiring soon), red (expired). Click to paste new token.

### 5.4 File List (Main Content Area)

#### Table/List View (default)
Column layout matching Teams:

| Column | Width | Content |
|--------|-------|---------|
| Type icon | 40px | File type icon (see 5.6) |
| Name | flex | File/folder name, semi-bold for folders |
| Modified | 160px | Relative time ("2 hours ago") or date |
| Modified By | 160px | Person name |
| Size | 100px | Human-readable (1.2 MB, 340 KB). Empty for folders. |
| Actions | 80px | "⋯" menu on hover |

- **Folders always sort first**, then files
- **Rows are hoverable** — subtle background highlight on hover
- **Double-click folder** → navigate into it
- **Single-click file** → select it (highlight row)
- **Double-click file** → download via `@microsoft.graph.downloadUrl`
- **Right-click or ⋯ button** → context menu

#### Grid View
- Card layout, 4-5 cards per row (responsive)
- Each card: Large file icon or thumbnail preview, filename below, modified date
- Folders show as folder cards with child count badge

### 5.5 File Type Icons

Must look like Microsoft Office icons. Use either Fluent UI icons from `@fluentui/react-icons` or build custom SVGs that match the Office icon style.

| Extension | Icon Style | Brand Color |
|-----------|-----------|-------------|
| .docx/.doc | Word "W" on blue doc | #2B579A |
| .xlsx/.xls | Excel "X" on green doc | #217346 |
| .pptx/.ppt | PowerPoint "P" on red doc | #D24726 |
| .pdf | PDF icon, red | #E5252A |
| .one | OneNote "N" on purple doc | #7719AA |
| .vsdx | Visio "V" on blue doc | #3955A3 |
| .png/.jpg/.gif/.svg | Image icon | #7B83EB |
| .mp4/.mov | Video icon | #E3008C |
| .mp3/.wav | Audio icon | #E3008C |
| .zip/.rar/.7z | Archive icon | #8764B8 |
| .txt/.md | Text doc icon | #69797E |
| .csv | CSV on green | #217346 |
| folder | Yellow folder (Teams style) | #FFB900 |
| default | Generic document | #69797E |

### 5.6 Empty States

- **No files**: "This channel doesn't have any files yet" with a subtle illustration
- **No teams**: Token entry screen (see section 3.5)
- **Loading**: Skeleton placeholders (animated shimmer rows matching the table layout)
- **Error**: "Couldn't load files. Check your connection." with retry button
- **Token expired**: Overlay with "Token expired — paste a new one" and the token input

### 5.7 Context Menu (Right-click or ⋯ button)

For files:
- Open in browser (opens `webUrl` in new tab → opens in SharePoint/Office Online)
- Download (triggers download via `@microsoft.graph.downloadUrl`)
- Copy link (copies `webUrl` to clipboard)
- Details (shows side panel with metadata)

For folders:
- Open
- Copy link

### 5.8 Details Panel (Optional — Right Side)

When "Details" is clicked, a panel slides in from the right showing:
- File preview/thumbnail (from thumbnails API)
- Full filename
- File type and size
- Modified date + by whom
- SharePoint custom columns (Source, Year, Category, etc.) if available
- Direct link to open in Teams/SharePoint

---

## 6. Design Language & Aesthetics

### 6.1 Theme: "Teams Refined"

A look that's clearly inspired by Microsoft Teams but with a more polished, modern finish. Think Teams meets Linear (linear.app).

### 6.2 Color Palette — Dark Theme (default)

```css
:root {
  /* Background layers */
  --bg-app: #1B1B2F;
  --bg-sidebar: #16162A;
  --bg-content: #1E1E3A;
  --bg-surface: #252547;
  --bg-surface-hover: #2D2D5E;
  --bg-selected: #3B3B7A;

  /* Accent */
  --accent-primary: #6264A7;
  --accent-hover: #7B7FCC;
  --accent-light: rgba(98, 100, 167, 0.12);

  /* Text */
  --text-primary: #E8E8F0;
  --text-secondary: #9898B8;
  --text-tertiary: #686888;
  --text-link: #8B8FD4;

  /* Borders */
  --border-default: #2A2A50;
  --border-subtle: #22223E;

  /* Token status */
  --token-valid: #6BB700;
  --token-warning: #FFB900;
  --token-expired: #C4314B;
}
```

### 6.3 Color Palette — Light Theme

```css
[data-theme="light"] {
  --bg-app: #F5F5F5;
  --bg-sidebar: #EBEBEB;
  --bg-content: #FFFFFF;
  --bg-surface: #FAFAFA;
  --bg-surface-hover: #F0F0F6;
  --bg-selected: #E8E8F4;
  --text-primary: #242424;
  --text-secondary: #616161;
  --text-tertiary: #8A8A8A;
  --border-default: #E0E0E0;
  --border-subtle: #EEEEEE;
}
```

### 6.4 Typography

Use **Segoe UI** as primary font (matches Teams).

```css
font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
```

| Element | Size | Weight |
|---------|------|--------|
| Team name (sidebar) | 14px | 600 |
| Channel name | 13px | 400 |
| File name | 14px | 400 (files), 600 (folders) |
| Column header | 12px | 600, uppercase, letter-spacing 0.5px |
| Metadata text | 12px | 400 |
| Breadcrumb | 14px | 400, last segment 600 |

### 6.5 Spacing & Layout

- Sidebar width: 240px (collapsible to 0)
- Row height: 42px (file list)
- Content padding: 16px
- Border radius: 6px (cards), 4px (buttons), 2px (inputs)
- Icon size: 20px inline, 32px in grid cards

---

## 7. Element Widget Integration

### 7.1 How Widgets Work in Element

Element supports custom widgets via iframes. A widget is a URL embedded inside a Matrix room.

### 7.2 Adding the Widget to a Room

```
/addwidget https://files.bsdu.eu
```

### 7.3 iframe Considerations

- Use `sessionStorage` not `localStorage` (iframe sandbox)
- CSP: `frame-ancestors https://element.bsdu.eu`
- Must also work standalone (not in iframe) for testing

---

## 8. Project Structure

```
teams-file-widget/
├── public/
│   └── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── auth/
│   │   ├── token-manager.ts
│   │   ├── TokenContext.tsx
│   │   └── TokenEntryScreen.tsx
│   ├── api/
│   │   ├── graph-client.ts
│   │   ├── teams.ts
│   │   ├── files.ts
│   │   └── types.ts
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Toolbar.tsx
│   │   ├── files/
│   │   │   ├── FileList.tsx
│   │   │   ├── FileGrid.tsx
│   │   │   ├── FileRow.tsx
│   │   │   ├── FileCard.tsx
│   │   │   ├── FileIcon.tsx
│   │   │   ├── ContextMenu.tsx
│   │   │   └── DetailsPanel.tsx
│   │   ├── common/
│   │   │   ├── Skeleton.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── Avatar.tsx
│   │   │   ├── SearchInput.tsx
│   │   │   └── TokenBadge.tsx
│   │   └── theme/
│   │       └── ThemeToggle.tsx
│   ├── hooks/
│   │   ├── useTeams.ts
│   │   ├── useChannels.ts
│   │   ├── useFiles.ts
│   │   ├── useNavigation.ts
│   │   └── useSearch.ts
│   ├── stores/
│   │   └── navigation-store.ts
│   ├── utils/
│   │   ├── format.ts
│   │   └── file-types.ts
│   ├── styles/
│   │   └── globals.css
│   └── types/
│       └── index.ts
├── .env.example
├── Dockerfile
├── nginx.conf
├── tailwind.config.ts
├── tsconfig.json
├── vite.config.ts
└── package.json
```

---

## 9. Key TypeScript Interfaces

```typescript
interface GraphUser {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
}

interface Team {
  id: string;
  displayName: string;
  description?: string;
}

interface Channel {
  id: string;
  displayName: string;
  description?: string;
}

interface DriveItem {
  id: string;
  name: string;
  size?: number;
  webUrl: string;
  lastModifiedDateTime: string;
  lastModifiedBy?: {
    user: {
      displayName: string;
      email?: string;
      id?: string;
    };
  };
  file?: {
    mimeType: string;
  };
  folder?: {
    childCount: number;
  };
  "@microsoft.graph.downloadUrl"?: string;
  listItem?: {
    fields: Record<string, unknown>;
  };
}

interface FilesFolder {
  id: string;
  name: string;
  parentReference: {
    driveId: string;
  };
}

interface NavigationState {
  selectedTeam: Team | null;
  selectedChannel: Channel | null;
  driveId: string | null;
  currentFolderId: string | null;
  pathStack: { id: string; name: string }[];
  viewMode: "list" | "grid";
  sortBy: "name" | "lastModifiedDateTime" | "size";
  sortDirection: "asc" | "desc";
}

interface TokenState {
  token: string | null;
  user: GraphUser | null;
  status: "valid" | "expiring" | "expired" | "none";
  setToken: (token: string) => Promise<boolean>;
  clearToken: () => void;
}
```

---

## 10. Graph API Client

```typescript
// api/graph-client.ts

import { tokenManager } from "../auth/token-manager";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export class TokenExpiredError extends Error {
  constructor() {
    super("Token expired");
    this.name = "TokenExpiredError";
  }
}

export async function graphFetch<T>(
  path: string,
  params?: Record<string, string>
): Promise<T> {
  const token = tokenManager.getToken();
  if (!token) throw new TokenExpiredError();

  const url = new URL(`${GRAPH_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (res.status === 401) {
    tokenManager.clearToken();
    throw new TokenExpiredError();
  }

  if (!res.ok) {
    throw new Error(`Graph API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}
```

---

## 11. Deployment

### 11.1 Dockerfile

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### 11.2 nginx.conf

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "frame-ancestors https://element.bsdu.eu" always;

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 11.3 Deploy to VM (vm-icc-lab-matrix)

Simplest path — the current nginx container already mounts `/data/files-widget`:

```bash
# Build locally or in CI
npm run build

# Copy dist to VM
scp -r dist/* iccadmin@20.71.154.184:/data/files-widget/

# Restart the container
ssh iccadmin@20.71.154.184 "cd /data/matrix-stack && sudo docker compose restart files-widget"
```

---

## 12. Behavior Requirements

### 12.1 Token Entry Flow
1. App loads → check `sessionStorage` for cached token
2. If no token → show TokenEntryScreen
3. User pastes token → call `GET /me` to validate
4. Valid → store in sessionStorage, show user name, load teams
5. Invalid → show error "Invalid token"
6. On any 401 → clear token, show "Token expired" overlay

### 12.2 Navigation Flow
1. Token accepted → fetch `/me/joinedTeams` → populate sidebar
2. User clicks a team → fetch channels → show in sidebar
3. User clicks a channel → get `filesFolder` → get `driveId` + root folder
4. Fetch folder children → display in file list
5. Double-click folder → push to pathStack, fetch children
6. Breadcrumbs update → click any segment to go back
7. Double-click file → download via `@microsoft.graph.downloadUrl`

### 12.3 Performance
- Cache teams/channels in memory
- Cache folder contents 30 seconds
- Skeleton UI while loading
- Load up to 200 items per folder
- Debounce search: 300ms

### 12.4 Error Handling
- **401** → token expired → show re-entry overlay
- **403** → "You don't have access to this team's files"
- **404** → "This channel doesn't have a files folder yet"
- **Network error** → retry button

---

## 13. Environment Variables

```env
# .env.example
VITE_APP_TITLE=ICC-LAB Files
VITE_DEFAULT_THEME=dark
```

No secrets. No Azure AD config. Fully client-side.

---

## 14. Phase 2 Features (After v1)

- Room auto-mapping via Matrix Widget API
- File upload via Graph API
- Inline file preview (images, PDFs, Office Online embed)
- SPO custom columns display (Source, Year, Category)
- Drag & drop files into Element chat
- Swap token-manager for MSAL.js if app registration becomes available
- Favorites / pinned folders

---

## 15. Summary for Claude Code

**Build a React + TypeScript + Vite project that:**

1. Shows a token entry screen where the user pastes a Microsoft Graph API bearer token
2. Validates the token by calling `GET /me`
3. Lists their Teams and channels in a left sidebar
4. Browses files/folders in any channel via Microsoft Graph API
5. Renders a polished dark-theme UI that looks like Microsoft Teams' Files tab but more refined
6. Supports list view (table) and grid view
7. Has breadcrumb navigation, search, sort, and context menus
8. Shows a token status indicator (valid/expiring/expired) with easy re-entry
9. Handles 401 errors gracefully by prompting for a new token
10. Builds as a static site served by nginx in Docker
11. Works both standalone and embedded as a widget inside Element

**No MSAL, no Azure AD app registration, no server-side code.** Auth is a manually-pasted bearer token in sessionStorage.

Start with real Graph API calls from the beginning. Wrap all API calls through the `graphFetch` client so the auth layer is centralized and swappable later.
