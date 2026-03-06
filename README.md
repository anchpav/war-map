# Global Conflict Tracker (GitHub Pages)

Static web project that displays global conflict events on a Leaflet map with no server-side code.

## What it does

- Loads conflict data with `fetch()` from an **online JSON URL** (`CONFLICTS_URL` in `script.js`).
- Uses a **local fallback** (`conflicts.json`) for testing/demo reliability.
- Renders:
  - red conflict markers,
  - yellow lines between `actor1` and `actor2`,
  - heatmap overlay,
  - popup with title, description, country.
- Provides filters:
  - year range filter,
  - dynamic country multi-select (all countries discovered from JSON).
- Shows **"Data unavailable"** if the online/local JSON cannot be loaded.

## Files

- `index.html`
- `style.css`
- `script.js`
- `conflicts.json` (sample, 5+ countries)

## Configure your online source

In `script.js`:

```js
const CONFLICTS_URL = "https://raw.githubusercontent.com/USERNAME/repo/main/conflicts.json";
const CONFLICTS_FALLBACK_URL = "./conflicts.json";
```

Replace `CONFLICTS_URL` with your real raw JSON URL.

Expected JSON item shape:

```json
{
  "id": 1,
  "lat": 50.4501,
  "lon": 30.5234,
  "title": "Conflict in Country A",
  "description": "Ongoing clashes",
  "country": "Country A",
  "year": 2026,
  "actor1": {"lat": 50.45, "lon": 30.52, "name": "Side A"},
  "actor2": {"lat": 50.46, "lon": 30.53, "name": "Side B"}
}
```

## Run locally

```bash
python3 -m http.server 8080
```

Open: `http://localhost:8080`

## GitHub Pages

1. Push repository to GitHub.
2. Enable Pages for branch root.
3. Open the generated Pages URL.
