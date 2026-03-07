# war-map

Lightweight geopolitical conflict dashboard MVP.

This repository intentionally stays simple:

- React + Vite + TypeScript frontend
- Node + Express backend
- D3 map rendering (GeoJSON + SVG + d3-zoom)
- One Python script for RSS-based conflict updates

## Target structure

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

## Run locally

### Backend

```bash
cd server
npm install
node index.js
```

### Frontend

```bash
cd client
npm install
npm run dev
```

## API

- `GET /api/conflicts`
  - Reads `client/public/data/conflicts.json`
  - Returns JSON list

## Conflict data model

`client/public/data/conflicts.json` uses simple pairs (no coordinates):

```json
[
  {
    "country": "Russia",
    "opponent": "Ukraine",
    "active": true
  }
]
```

Coordinates are computed automatically from GeoJSON country centroids.

## Notes

- Country heat intensity is based on number of conflicts per country.
- Conflict lines are curved SVG paths with CSS dash animation.
- `scripts/updateConflicts.py` can fetch RSS headlines and append new conflict pairs.
