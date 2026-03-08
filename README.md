# Global War Tracker (Minimal MVP)

A beginner-friendly MVP with:

- **React + Vite + D3** frontend
- **Express** backend
- Local `GeoJSON` world map and local conflict dataset

## Project structure

```text
client/
  src/
    components/
      WorldMap.tsx
      ConflictLines.tsx
      CountrySearch.tsx
      MetricsPanel.tsx
    services/
      conflictService.ts
      geoService.ts
    types/
      index.ts
    App.tsx
    main.tsx
  public/
    data/
      conflicts.json
      world.geo.json

server/
  index.js
```

## Install

### Backend

```bash
cd server
npm install
node index.js
```

Backend runs at `http://localhost:3001`.

### Frontend

```bash
cd client
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

## API

- `GET /api/conflicts` - reads and returns `client/public/data/conflicts.json`

## Features

- SVG world map rendered from `world.geo.json` using `d3.geoMercator`
- Country hover + click selection
- Country search with autocomplete
- Animated dashed conflict lines
- Metrics:
  - total conflicts
  - active conflicts
  - days without war (world)
  - days without war (selected country)
- Friendly error messages when server/data is unavailable
