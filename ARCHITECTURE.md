# Global War Tracker Architecture

This repository is intentionally lightweight and split into three simple parts:

- `client/` — React + TypeScript + D3 tactical dashboard UI
- `server/` — Express API and admin-protected control endpoints
- `scripts/` — optional data refresh tooling

## Core principles

1. Keep map rendering stable and bounded.
2. Keep admin auth and session security stable.
3. Prefer small, targeted changes over broad rewrites.
4. Avoid heavy frameworks and unnecessary abstractions.

## Protected files

These files are protected infrastructure and must not be modified casually:

- `server/index.js`

### Why `server/index.js` is protected

`server/index.js` contains the active production wiring for:

- admin email verification flow
- signed cookie session flow
- protected admin endpoints

Changes to this file can break admin authentication and secure access controls.
Only make minimal, approved edits when absolutely required.
