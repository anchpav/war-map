# Global War Tracker (Minimal Working MVP)

A minimal local-first application for tracking armed conflicts and showing **Days Without War**.

## What this MVP includes

- **Custom minimalist world map** built with **SVG + plain JavaScript** (no Leaflet / no tile providers).
- **Clickable countries** (simplified shapes) and **country search**.
- **Pan + zoom** with mouse and touch gestures.
- **Animated conflict lines/arrows** shown in timeline order.
- **Hover tooltip** on conflict lines with:
  - Country names
  - Start and end dates
  - Conflict type
- **Days Without War** metric:
  - Global
  - Selected country
- **Active conflicts list**
- **Refresh Data** button to reload `conflicts.json` from backend.

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
    style.css
    app.js
  scripts/
    run_server.py
  README.md
```

## Requirements

- Python 3.x
- Flask

Install:

```bash
python -m pip install -r global-war-tracker/requirements.txt
```

## Run locally

From repository root:

```bash
python global-war-tracker/scripts/run_server.py
```

Then open:

```text
http://localhost:5000
```

## Backend API

- `GET /api/days_without_war?country=<country>`
  - Returns days without war globally or for selected country.
- `GET /api/active_conflicts?country=<country>`
  - Returns active conflicts globally or filtered by country.
- `GET /api/conflicts`
  - Returns all conflicts from `conflicts.json`.
- `GET /data/conflicts.json`
  - Serves raw JSON file.

## Data format (`conflicts.json`)

```json
[
  {
    "country": "Country A",
    "opponent": "Country B",
    "start": "YYYY-MM-DD",
    "end": null,
    "lat": 0,
    "lon": 0
  }
]
```

## Notes

- This MVP intentionally uses simplified country geometry for a lightweight custom map.
- The map is designed to be easy to extend with richer SVG paths later.
- Geolocation-based country detection depends on browser permissions.
