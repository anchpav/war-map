"""Flask backend for GLOBAL WAR TRACKER.

Responsibilities:
- Serve static frontend files for local-first use.
- Provide JSON APIs for conflicts, history, metrics, and AI updates.
"""

from __future__ import annotations

from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from .ai_updater import run_ai_update_pipeline
from .conflict_parser import (
    calculate_days_without_war,
    calculate_global_tension_index,
    load_conflicts,
    load_history,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")


@app.route("/")
def index():
    """Serve dashboard UI."""

    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/api/conflicts")
def api_conflicts():
    """Return conflict list for map rendering.

    Supports optional query params:
    - year: include conflicts active in that year
    - country: include only one country
    """

    conflicts = load_conflicts()
    year = request.args.get("year", type=int)
    country = request.args.get("country", type=str)

    filtered = conflicts
    if country:
        filtered = [c for c in filtered if c.get("country", "").lower() == country.lower()]

    if year:
        def in_year(record: dict) -> bool:
            start_year = int(record["start"].split("-")[0])
            end_value = record.get("end")
            end_year = int(end_value.split("-")[0]) if end_value else 9999
            return start_year <= year <= end_year

        filtered = [c for c in filtered if in_year(c)]

    return jsonify(filtered)


@app.route("/api/history")
def api_history():
    """Return historical conflicts since 1900."""

    return jsonify(load_history())


@app.route("/api/metrics")
def api_metrics():
    """Return key dashboard metrics."""

    conflicts = load_conflicts()
    history = load_history()

    country = request.args.get("country", type=str)
    days_without_war = calculate_days_without_war(conflicts, country=country)
    active_conflicts = sum(1 for c in conflicts if c.get("end") is None)
    total_conflicts_since_1900 = len(history)
    tension_index = calculate_global_tension_index(conflicts, history)

    return jsonify(
        {
            "days_without_war": days_without_war,
            "active_conflicts": active_conflicts,
            "total_conflicts_since_1900": total_conflicts_since_1900,
            "global_military_tension_index": tension_index,
        }
    )


@app.route("/api/ai-update", methods=["POST"])
def api_ai_update():
    """Trigger automated update pipeline manually from UI or script."""

    result = run_ai_update_pipeline()
    return jsonify(result)


if __name__ == "__main__":
    # Debug=True is convenient for local development and educational exploration.
    app.run(host="0.0.0.0", port=5000, debug=True)
