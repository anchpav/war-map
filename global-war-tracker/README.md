# Global War Tracker — Minimal Working Version

This is a minimal, runnable version of Global War Tracker with:

- Leaflet world map (zoom + pan)
- Country search/filter
- Conflict markers + popups
- Animated conflict lines/arrows (timeline play/pause)
- Metrics:
  - Days Without War (global)
  - Days Without War (selected country)
  - Active conflicts
  - Total conflicts
- Local `conflicts.json` data source

## Project structure

```text
global-war-tracker/
  backend/
    server.py
    data_handler.py
  data/
    conflicts.json
  frontend/
    index.html
    script.js
    style.css
    conflicts.json
  scripts/
    run_server.py
  README.md
```

## Data format

`data/conflicts.json` entries include required fields:

```json
{
  "id": "unique-id",
  "country": "Country A",
  "lat": 0,
  "lon": 0,
  "start": "YYYY-MM-DD",
  "end": null,
  "description": "Conflict type"
}
```

(For arrow visualization, optional fields `opponent`, `opponentLat`, `opponentLon` are used.)

## Run locally (recommended)

1. Install dependencies:

```bash
python -m pip install -r global-war-tracker/requirements.txt
```

2. Start backend from repository root:

```bash
python global-war-tracker/scripts/run_server.py
```

3. Open app:

```text
http://localhost:5000
```

## Frontend-only local fallback

If backend is unavailable, frontend can still load local data from `frontend/conflicts.json`.

```bash
cd global-war-tracker/frontend
python -m http.server 8080
```

Open:

```text
http://localhost:8080
```

## API

- `GET /api/conflicts` → all conflicts from local JSON
