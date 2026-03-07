# GLOBAL WAR TRACKER

A local-first full-stack project for visualizing armed conflicts since 1900.

## Features

- Interactive Leaflet world map with conflict markers
- Marker color coding:
  - **Red** = active conflict (`end = null`)
  - **Orange** = recent conflict
  - **Gray** = historical conflict
- Dashboard metrics:
  - Active conflicts
  - Total conflicts since 1900
  - Days Without War
  - Global Military Tension Index
- Settings panel (⚙️) with year slider, country multi-select, and AI mode selector
- AI update pipeline with **OpenAI mode** + **offline mock mode**
- Timeline animation and basic conflict-zone prediction placeholder

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
