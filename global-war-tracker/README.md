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

## Project Structure

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
