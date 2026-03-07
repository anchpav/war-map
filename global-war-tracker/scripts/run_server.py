"""Convenience launcher for GLOBAL WAR TRACKER backend.

Why this script exists:
- New users often run commands from repository root.
- `python -m backend.server` only works when cwd is `global-war-tracker/`.
- This script works from anywhere and provides a friendlier startup path.

Usage examples:
    python global-war-tracker/scripts/run_server.py
    cd global-war-tracker && python scripts/run_server.py
"""

from __future__ import annotations

from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.server import app  # noqa: E402


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
