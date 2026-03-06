"""CLI script to run AI conflict update pipeline.

Usage:
    python scripts/update_conflicts.py
"""

from __future__ import annotations

from pathlib import Path
import sys

# Ensure backend package is importable when script is run directly.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.append(str(PROJECT_ROOT))

from backend.ai_updater import run_ai_update_pipeline  # noqa: E402


if __name__ == "__main__":
    result = run_ai_update_pipeline()
    print("AI update completed:")
    for key, value in result.items():
        print(f"- {key}: {value}")
