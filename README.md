# LAB Files + Sync Widget

React + TypeScript + Vite widget for:

- Browsing Microsoft Teams channel files via Microsoft Graph API.
- Syncing Teams channel messages into Element (Matrix) rooms.

The app runs standalone in a browser and embedded in Element as an iframe widget.

## Features

### Files Tab

- Manual Graph bearer token entry and `/me` validation.
- Teams and channels browsing.
- Channel files/folders from SharePoint/Graph.
- List and grid views, breadcrumbs, sorting, search, context actions.
- Details panel with metadata, thumbnail, and list fields fallback handling.

### Sync Tab

- Channel-to-room mapping (create room or use existing room).
- Quick Setup: bulk-create rooms from team channels.
- Optional widget auto-pin using `window.location.origin`.
- Optional backfill when creating mappings.
- Polling sync engine for top-level channel messages only.
- Matrix rate-limit backoff (429 + `Retry-After` support).
- Per-channel errors and activity log.
- Sync engine runs only while Sync tab is active and pauses on Files tab.

## Authentication Model

- Graph token: required for Files and Sync message reads.
- Matrix token: required only for Sync writes.
- Both tokens are stored in `sessionStorage` only.

Default Matrix homeserver: `https://matrix.bsdu.eu` (editable in token modal).

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS
- TanStack Query + Zustand
- Radix UI primitives
- matrix-js-sdk (installed extension point, HTTP wrappers currently used)
- Vitest + Testing Library

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env
```

3. Start dev server:

```bash
npm run dev
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Type-check and build production bundle
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint
- `npm run test` - Run Vitest in watch mode
- `npm run test:run` - Run Vitest once

## Environment Variables

See `.env.example`:

- `VITE_APP_TITLE`
- `VITE_DEFAULT_THEME` (`dark` or `light`)

## Notes

- No backend and no Azure app registration required.
- Sync behavior is session-based and client-side only; no always-on background worker.
- Files browsing continues to work without Matrix token.
- In local development (`npm run dev`), Graph requests are routed through a Vite proxy (`/graph-proxy`) to avoid browser CORS/preflight issues.
