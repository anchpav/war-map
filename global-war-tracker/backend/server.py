"""Flask backend for GLOBAL WAR TRACKER."""

from __future__ import annotations

from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from .ai_updater import run_ai_update_pipeline
from .conflict_parser import (
    calculate_days_without_war,
    calculate_global_tension_index,
    calculate_total_conflicts_since_1900,
    filter_conflicts_by_country,
    load_conflicts,
    load_history,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")


def _merge_conflicts_and_history(conflicts: list[dict], history: list[dict]) -> list[dict]:
    """Merge records from history and current conflicts without duplicate IDs."""

    merged_by_id: dict[str, dict] = {}
    for record in [*history, *conflicts]:
        if record.get("id"):
            merged_by_id[record["id"]] = record
    return list(merged_by_id.values())


@app.route("/")
def index():
    """Serve dashboard UI."""

    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/api/conflicts")
def api_conflicts():
    """Return current conflict list for map rendering with optional filters."""

    conflicts = load_conflicts()
    year = request.args.get("year", type=int)
    country = request.args.get("country", type=str)

    filtered = filter_conflicts_by_country(conflicts, country)

    if year:

        def in_year(record: dict) -> bool:
            start_year = int(record["start"].split("-")[0])
            end_value = record.get("end")
            end_year = int(end_value.split("-")[0]) if end_value else 9999
            return start_year <= year <= end_year

        filtered = [c for c in filtered if in_year(c)]

    return jsonify(filtered)


@app.route("/api/active-conflicts")
def api_active_conflicts():
    """Return only active conflicts (end = null), optionally filtered by country."""

    conflicts = load_conflicts()
    country = request.args.get("country", type=str)
    scoped = filter_conflicts_by_country(conflicts, country)
    active = [record for record in scoped if record.get("end") is None]
    return jsonify(active)


@app.route("/api/history")
def api_history():
    """Return historical conflicts since 1900."""

    return jsonify(load_history())


@app.route("/api/country-days")
def api_country_days():
    """Return days-without-war for global or selected country.

    If country is omitted, returns global value.
    """

    conflicts = load_conflicts()
    history = load_history()

    country = request.args.get("country", type=str)
    all_records = _merge_conflicts_and_history(conflicts, history)

    scoped = filter_conflicts_by_country(all_records, country)
    days_without_war = calculate_days_without_war(scoped)

    return jsonify({"country": country or "global", "days_without_war": days_without_war})


@app.route("/api/metrics")
def api_metrics():
    """Return key dashboard metrics with consistent scope."""

    conflicts = load_conflicts()
    history = load_history()

    country = request.args.get("country", type=str)
    scoped_conflicts = filter_conflicts_by_country(conflicts, country)

    days_without_war = calculate_days_without_war(_merge_conflicts_and_history(conflicts, history), country=country)
    active_conflicts = sum(1 for c in scoped_conflicts if c.get("end") is None)
    total_conflicts_since_1900 = calculate_total_conflicts_since_1900(conflicts, history)
    tension_index = calculate_global_tension_index(scoped_conflicts, history)

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
    app.run(host="0.0.0.0", port=5000, debug=True)
