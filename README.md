# Global War Tracker

Minimal React + Vite + D3 conflict map with a lightweight Express API.

## What was cleaned up

- Removed legacy static frontend entry files (single entrypoint only).
- Frontend now boots only from `client/src/main.tsx` via `client/index.html`.
- Moved data loading to small service modules:
  - `client/src/services/conflictService.ts`
  - `client/src/services/geoService.ts`
- Optimized map rendering to use only `d3-geo`, `d3-selection`, `d3-zoom`.
- Kept project architecture simple: one frontend, one backend, local JSON data.

## Project structure

```text
war-map/
├ client/
│  ├ index.html
│  ├ package.json
│  ├ vite.config.ts
│  ├ tsconfig.json
│  ├ public/data/
│  │  ├ conflicts.json
│  │  └ world.geo.json
│  └ src/
│     ├ main.tsx
│     ├ App.tsx
│     ├ styles.css
│     ├ types/index.ts
│     ├ services/
│     │  ├ conflictService.ts
│     │  └ geoService.ts
│     └ components/
│        ├ WorldMap.tsx
│        ├ ConflictLines.tsx
│        ├ CountrySearch.tsx
│        └ MetricsPanel.tsx
├ server/
│  ├ index.js
│  └ package.json
├ scripts/
│  └ updateConflicts.py
├ run.ps1
└ package.json
```

## Run locally

### Backend

```bash
cd server
node index.js
```

### Frontend

```bash
cd client
npm install
npm run dev
```

UI: `http://localhost:5173`

## Notes

- `WorldMap.tsx` memoizes heavy projection/path work for stable performance.
- Country labels are rendered only when zoom level is above `2`.
- Conflict lines are curved SVG paths with CSS dash animation (lightweight strategy-map style).
- Data is loaded once on startup (`/api/conflicts` with fallback to `/data/conflicts.json`).
