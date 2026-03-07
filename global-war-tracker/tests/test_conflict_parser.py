"""Unit tests for conflict parsing and metrics helpers."""

from datetime import date, timedelta
import unittest

from backend.conflict_parser import calculate_days_without_war


class TestCalculateDaysWithoutWar(unittest.TestCase):
    def test_returns_zero_when_any_conflict_active(self) -> None:
        conflicts = [
            {"country": "A", "end": None},
            {"country": "A", "end": "2020-01-01"},
        ]
        self.assertEqual(calculate_days_without_war(conflicts), 0)

    def test_returns_days_since_most_recent_end(self) -> None:
        latest = date.today() - timedelta(days=9)
        older = date.today() - timedelta(days=30)
        conflicts = [
            {"country": "A", "end": older.isoformat()},
            {"country": "B", "end": latest.isoformat()},
        ]
        self.assertEqual(calculate_days_without_war(conflicts), 9)

    def test_country_specific_filtering(self) -> None:
        ended = date.today() - timedelta(days=4)
        conflicts = [
            {"country": "Ukraine", "end": ended.isoformat()},
            {"country": "Syria", "end": None},
        ]
        self.assertEqual(calculate_days_without_war(conflicts, country="Ukraine"), 4)
        self.assertEqual(calculate_days_without_war(conflicts, country="Syria"), 0)


if __name__ == "__main__":
    unittest.main()
