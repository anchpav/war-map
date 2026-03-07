"""Flask backend for Global War Tracker MVP."""

from __future__ import annotations

from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from .ai_updater import run_ai_update_pipeline
from .data_handler import calculate_days_without_war, filter_by_country, get_active_conflicts, load_conflicts

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"
DATA_FILE = PROJECT_ROOT / "data" / "conflicts.json"

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")


@app.route("/")
def index() -> object:
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/api/conflicts")
def api_conflicts() -> object:
    conflicts = load_conflicts()
    country = request.args.get("country", type=str)
    return jsonify(filter_by_country(conflicts, country))


@app.route("/api/days_without_war")
def api_days_without_war() -> object:
    conflicts = load_conflicts()
    country = request.args.get("country", default=None, type=str)

    response = {
        "country": country,
        "days_without_war": calculate_days_without_war(conflicts, country),
        "active_conflicts": len(get_active_conflicts(conflicts, country)),
        "total_conflicts": len(filter_by_country(conflicts, country)),
    }
    return jsonify(response)


@app.route("/api/update_conflicts", methods=["POST"])
def api_update_conflicts() -> object:
    result = run_ai_update_pipeline()
    return jsonify(result)


@app.route("/data/conflicts.json")
def api_raw_conflicts_file() -> object:
    return send_from_directory(DATA_FILE.parent, DATA_FILE.name)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
