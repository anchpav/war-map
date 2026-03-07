"""Minimal Flask API for Global War Tracker MVP.

Only essential backend functionality is included:
- Serve frontend files
- Serve local conflict data via /api/conflicts
"""

from __future__ import annotations

from pathlib import Path
import json

from flask import Flask, jsonify, send_from_directory

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"
DATA_FILE = PROJECT_ROOT / "data" / "conflicts.json"

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")


@app.route("/")
def index():
    """Serve the minimal web UI."""

    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/api/conflicts")
def api_conflicts():
    """Return conflicts from local JSON file."""

    with DATA_FILE.open("r", encoding="utf-8") as file:
        conflicts = json.load(file)
    return jsonify(conflicts)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
