# war-map MVP

Minimal Global War Tracker with a custom SVG world map (GeoJSON + D3), React client, and Express backend.

## Stack

- **Client**: React + TypeScript + Vite + D3
- **Server**: Node.js + Express
- **Data**: Local JSON files in `client/public/data`

## Features

- Custom-rendered world map from local `world.geo.json` (no tile providers)
- Country hover + click selection
- Country search with autocomplete
- Animated conflict lines between countries
- Metrics:
  - Total conflicts
  - Active conflicts
  - Days without war (world)
  - Days without war (selected country)
- Safe AI update placeholder endpoint

## Project structure

```text
war-map/
├── client/
│   ├── public/data/
│   │   ├── world.geo.json
│   │   └── conflicts.json
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   ├── types/
│   │   ├── utils/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── styles.css
│   ├── package.json
│   └── vite.config.ts
├── server/
│   ├── index.js
│   ├── config.js
│   └── services/aiService.js
├── .env.example
├── .gitignore
└── README.md
```

## Setup

### 1) Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 2) Environment variables

Copy `.env.example` to `.env` in repository root and fill values if needed:

```bash
cp .env.example .env
```

`.env` must **not** be committed.

### 3) Run server

```bash
cd server
npm run dev
```

Server starts on `http://localhost:3001`.

### 4) Run client

```bash
cd client
npm run dev
```

Client starts on `http://localhost:5173` and proxies `/api/*` to the server.

## API

- `GET /api/conflicts` - returns conflicts from local JSON
- `GET /api/metrics?country=<name>` - returns calculated metrics
- `POST /api/update-conflicts` - calls placeholder AI update service

## Notes

- `server/services/aiService.js` is intentionally a stub with TODO comments.
- Replace stubs with real DeepSeek/Gemini integration when ready.
