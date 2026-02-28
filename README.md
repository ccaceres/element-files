# ICC-LAB Teams File Widget

React + TypeScript + Vite widget for browsing Microsoft Teams channel files inside Element via Microsoft Graph API.

## What It Does

- Accepts a manually pasted Microsoft Graph bearer token (stored in `sessionStorage`)
- Validates token via `GET /me`
- Loads joined teams and channels
- Browses channel files/folders directly from SharePoint via Graph (no sync/copy)
- Supports list and grid views, breadcrumbs, sorting, search, context actions, and details panel
- Handles token expiry globally (401 clears token and prompts re-entry)

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS
- TanStack Query + Zustand
- Radix UI primitives
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

- Authentication uses manually pasted Graph Explorer token only.
- No backend and no Azure app registration required.
- Widget works standalone and in iframe embedding mode.
