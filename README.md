# Global War Tracker

Minimal React + Vite + D3 conflict map with a lightweight Express API.

## What was cleaned up

- Removed legacy static frontend entry files (single entrypoint only).
- Frontend now boots only from `client/src/main.tsx` via `client/index.html`.
- Moved data loading to small service modules:
  - `client/src/services/conflictService.ts`
  - `client/src/services/geoService.ts`
- Optimized map rendering to use only `d3-geo`, `d3-selection`, `d3-zoom`.
- Kept project architecture simple: one frontend, one backend, local JSON data.

## Project structure

```text
war-map/
├ client/
│  ├ index.html
│  ├ package.json
│  ├ vite.config.ts
│  ├ tsconfig.json
│  ├ public/data/
│  │  ├ conflicts.json
│  │  └ world.geo.json
│  └ src/
│     ├ main.tsx
│     ├ App.tsx
│     ├ styles.css
│     ├ types/index.ts
│     ├ services/
│     │  ├ conflictService.ts
│     │  └ geoService.ts
│     └ components/
│        ├ WorldMap.tsx
│        ├ ConflictLines.tsx
│        ├ CountrySearch.tsx
│        └ MetricsPanel.tsx
├ server/
│  ├ index.js
│  └ package.json
├ scripts/
│  └ updateConflicts.py
├ run.ps1
└ package.json
```

## Run locally

### Backend

```bash
cd server
node index.js
```

### Frontend

```bash
cd client
npm install
npm run dev
```

UI: `http://localhost:5173`

## Environment Setup

1) Copy the template:

```bash
cp .env.example .env
```

2) Fill in the required values:

- `GEMINI_API_KEY`
- `ADMIN_EMAIL`
- `ADMIN_SESSION_SECRET`
- SMTP settings (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`)

3) Restart the server so new environment variables are loaded.

## Protected files

The following file is protected infrastructure and should only be changed with focused review:

- `server/index.js`

Reason: it contains admin email verification, signed cookie sessions, and protected admin endpoint wiring.

## Notes

- `WorldMap.tsx` memoizes heavy projection/path work for stable performance.
- Country labels are rendered only when zoom level is above `2`.
- Conflict lines are curved SVG paths with CSS dash animation (lightweight strategy-map style).
- Data is loaded once on startup (`/api/conflicts` with fallback to `/data/conflicts.json`).

## AI-assisted conflict refresh

The project includes a conservative updater:

```bash
python scripts/updateConflicts.py --provider gemini --input scripts/sample_news.txt
python scripts/updateConflicts.py --provider deepseek --input scripts/sample_news.txt --apply
```

### Environment variables

- `AI_PROVIDER=deepseek|gemini` (optional default)
- `DEEPSEEK_API_KEY=...` (required for `--provider deepseek`)
- `GEMINI_API_KEY=...` (required for `--provider gemini`)

### Modes

- **Preview mode (default):** writes merged review output to `client/public/data/conflicts.suggested.json`
- **Apply mode (`--apply`):** writes merged output to `client/public/data/conflicts.json`

### CLI flags

- `--provider deepseek|gemini`
- `--input path/to/news.txt` (optional; if omitted script reads RSS headlines)
- `--limit 20`
- `--apply`

### Safety and anti-hallucination behavior

- Prompt enforces strict JSON-only extraction and returns `[]` if uncertain.
- Validation rejects malformed/low-confidence/unrecognized country rows.
- Canonical country names are loaded from `client/public/data/world.geo.json`.
- Deduplication is pair-based and conservative updates are confidence-gated.
- Script logs skipped entries for manual review.

