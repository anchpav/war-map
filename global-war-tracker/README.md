# GLOBAL WAR TRACKER

A local-first full-stack project for visualizing armed conflicts since 1900.

## Features

- Minimalist interactive world map (Leaflet)
- Country search (manual) + "My country" geolocation helper
- Days Without War for:
  - all world (global mode)
  - selected country
- Active conflicts list (always visible in side panel)
- Refresh Data button that updates both map and metrics
- Timeline animation with play/pause (old conflicts first)
- Optional AI refresh mode before data reload

## Project structure

```text
global-war-tracker/
  backend/
    server.py
    ai_updater.py
    conflict_parser.py
    data_sources.py
  data/
    conflicts.json
    history_1900.json
  frontend/
    index.html
    style.css
    app.js
  scripts/
    update_conflicts.py
  README.md
```

## Run locally

### Option A (from repository root)

```bash
python -m pip install -r global-war-tracker/requirements.txt
python global-war-tracker/scripts/run_server.py
```

### Option B (from project directory)

```bash
cd global-war-tracker
python -m pip install -r requirements.txt
python -m backend.server
```

Open: `http://localhost:5000`

## Run AI update script

```bash
cd global-war-tracker
python scripts/update_conflicts.py
```

### Mock mode behavior

If `OPENAI_API_KEY` is missing, updater automatically uses local keyword detection:
- war
- invasion
- military strike
- armed conflict
- missile attack
- clash

This guarantees local/offline operation.


## GitHub update workflow

Use this short flow whenever you need to update files in GitHub:

```bash
cd global-war-tracker
python -m pip install -r requirements.txt
git add .
git commit -m "Update GLOBAL WAR TRACKER files"
git push origin <your-branch>
```

Then open a Pull Request in GitHub and merge it into your main branch.

## API endpoints

- `GET /api/conflicts`
- `GET /api/history`
- `GET /api/metrics`
- `POST /api/ai-update` (kept for backend/scheduler usage; manual UI trigger removed)

## Extend later with real APIs

- Add geocoding in `ai_updater.py` for precise coordinates.
- Add dedicated source connectors in `data_sources.py`.
- Replace placeholder prediction with ML model using historical data.


## Testing

```bash
cd global-war-tracker
python -m unittest discover -s tests -p "test_*.py"
```


## Troubleshooting server startup

If you see `ModuleNotFoundError: No module named 'backend'`, you are likely running
`python -m backend.server` from the repository root. Use either:

- `python global-war-tracker/scripts/run_server.py` from root, or
- `cd global-war-tracker` then `python -m backend.server`.


## Dashboard controls

- **Filters & Settings dropdown**: countries (multi-select), year slider, AI refresh mode.
- **Refresh Data**: reloads data and metrics; in AI mode it first calls `/api/ai-update`.
- **Timeline controls**: play/pause conflict sequence from oldest to newest.

All metrics are fetched fresh from backend endpoints with cache-busting requests.


## MVP usage flow

1. Open app and choose a country in the search field (or click **Моя страна**).
2. Move the year slider to filter map conflicts by timeline.
3. Check **Дней без войны** and **Активные конфликты** in the side panel.
4. Click **Refresh Data** to reload map + metrics (or run AI update first if selected).
5. Use **Play/Pause** to watch chronological conflict animation.
