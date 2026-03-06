# Global War Tracker

A static, GitHub Pages-ready web app that visualizes live conflict events on an interactive Leaflet map.

## Features

- **Days Without Major War** counter based on a configurable reference date.
- **Interactive world map** (zoom, pan, popups).
- **Live conflict markers** loaded dynamically from `https://liveuamap.com/api/events`.
- **Directional lines/arrows** when source/target coordinates are available.
- **Heatmap overlay** showing relative conflict intensity.
- **Timeline year slider** for quick event filtering.
- Modern, responsive dark-theme interface.

## Local Run

Because this app fetches remote JSON, run it from a local HTTP server (not `file://`):

```bash
python3 -m http.server 8080
```

Then open: `http://localhost:8080`

## Data Source Maintenance

If LiveUAMap changes schema or you want a different provider:

1. Update `API_ENDPOINTS` in `script.js`.
2. Map provider fields in `normalizeEvent()` to the app's standard event shape.
3. Keep rendering functions (`renderMarkers`, `renderHeatmap`) as-is whenever possible.

## GitHub Pages Deployment

1. Push this repository to GitHub.
2. In repository settings, enable **Pages** and select the branch root.
3. Visit the generated Pages URL.
