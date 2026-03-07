"""Flask backend for minimal Global War Tracker MVP."""

from __future__ import annotations

from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from .data_handler import (
    calculate_days_without_war,
    get_active_conflicts,
    load_conflicts,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"
DATA_DIR = PROJECT_ROOT / "data"

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")


@app.route("/")
def index():
    """Serve single-page frontend."""

    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/api/conflicts")
def api_conflicts():
    """Return all conflicts (active + ended)."""

    return jsonify(load_conflicts())


@app.route("/api/active_conflicts")
def api_active_conflicts():
    """Return active conflicts, optionally filtered by country.

    Query:
        /api/active_conflicts?country=Ukraine
    """

    country = request.args.get("country", type=str)
    conflicts = load_conflicts()
    return jsonify(get_active_conflicts(conflicts, country=country))


@app.route("/api/days_without_war")
def api_days_without_war():
    """Return days without war globally or for selected country.

    Query:
        /api/days_without_war
        /api/days_without_war?country=Germany
    """

    country = request.args.get("country", type=str)
    conflicts = load_conflicts()
    days = calculate_days_without_war(conflicts, country=country)
    return jsonify({"country": country or "global", "days_without_war": days})


@app.route("/data/conflicts.json")
def raw_conflicts_file():
    """Serve raw local JSON for manual inspection/debug."""

    return send_from_directory(DATA_DIR, "conflicts.json")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
