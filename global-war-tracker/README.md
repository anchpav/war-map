# Global War Tracker (MVP)

Minimal full-stack app for tracking global conflicts with a Leaflet map and AI-assisted updates.

## Features

- Leaflet world map centered at `[20, 0]` with zoom/pan.
- Conflict markers + popups.
- Animated conflict lines (timeline play/pause).
- Country search/filter.
- Metrics:
  - Active conflicts
  - Total conflicts
  - Days without war (world and selected country)
- AI updater with fallback chain:
  1. DeepSeek (`DEEPSEEK_API_KEY`)
  2. Gemini (`GEMINI_API_KEY`)
  3. Local keyword mock mode (offline)

## Project structure

```text
global-war-tracker/
  backend/
    server.py
    ai_updater.py
    data_handler.py
    data_sources.py
  data/
    conflicts.json
  frontend/
    index.html
    style.css
    script.js
  scripts/
    run_server.py
    update_conflicts.py
```

## Run locally

```bash
cd global-war-tracker
python -m pip install -r requirements.txt
python -m backend.server
```

Open: <http://localhost:5000>

## Environment variables (optional)

```bash
export DEEPSEEK_API_KEY=YOUR_DEEPSEEK_KEY
export GEMINI_API_KEY=YOUR_GEMINI_KEY
```

If both keys are missing or requests fail, the updater automatically uses offline mock detection.

## API

- `GET /api/conflicts`
- `GET /api/days_without_war?country=<country>`
- `POST /api/update_conflicts`

## Update conflicts from CLI

```bash
cd global-war-tracker
python scripts/update_conflicts.py
```
