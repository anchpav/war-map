# Global War Tracker

A lightweight geopolitical dashboard built with **React + TypeScript + D3** and a minimal **Express** API.

The project focuses on clarity:
- one frontend app,
- one backend endpoint,
- one local data model,
- one optional updater script.

## Screenshot

_Add your local screenshot here after running the app (for example `docs/screenshot.png`)._

## Features

- Responsive D3 world map using `geoMercator().fitSize(...)`
- Zoom + pan (`d3-zoom`, 1x to 8x)
- Country hover tooltip and country selection
- Search-driven country focus (zoom to country bounds)
- Conflict heat intensity by country involvement
- Curved, animated, glowing conflict lines
- Timeline slider (1900 → current year)
- Recent conflicts panel
- Legend panel
- Country details panel
- Keyboard shortcuts:
  - `F`: focus search
  - `ESC`: close selected country panel
  - `R`: reset map zoom

## Project structure

```text
war-map/
├ client/
│  ├ src/
│  │  ├ components/
│  │  │  ├ WorldMap.tsx
│  │  │  ├ ConflictLines.tsx
│  │  │  ├ CountrySearch.tsx
│  │  │  └ MetricsPanel.tsx
│  │  ├ api/
│  │  │  └ api.ts
│  │  └ types/
│  │     └ index.ts
│  └ public/data/
│     ├ world.geo.json
│     └ conflicts.json
├ server/
│  └ index.js
├ scripts/
│  └ updateConflicts.py
├ run.ps1
└ package.json
```

## Data model

`client/public/data/conflicts.json`

```json
[
  {
    "country": "Russia",
    "opponent": "Ukraine",
    "start": "2022-02-24",
    "active": true
  }
]
```

Coordinates are not stored in conflicts data.
Map line positions are computed dynamically using GeoJSON country centroids (`d3.geoCentroid`).

## Run locally

### Backend

```bash
cd server
npm install
node index.js
```

Backend API:
- `GET /api/conflicts` → reads `client/public/data/conflicts.json`

### Frontend

```bash
cd client
npm install
npm run dev
```

### Optional updater script

```bash
python scripts/updateConflicts.py
```

The script reads RSS feeds, extracts likely conflict country pairs, and appends new records.

## Technology stack

- React
- TypeScript
- D3 (`d3-geo`, `d3-zoom`, `d3-shape`)
- CSS animations
- Node + Express
- Python (`feedparser`, `requests`) for optional data updates
