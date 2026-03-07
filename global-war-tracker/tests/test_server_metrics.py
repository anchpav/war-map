"""Tests for metrics scoping behavior in server helpers."""

import unittest

from backend.conflict_parser import filter_conflicts_by_country


class TestServerMetricsScoping(unittest.TestCase):
    def test_country_filter_returns_only_selected_country(self) -> None:
        conflicts = [
            {"country": "Ukraine", "end": None},
            {"country": "Syria", "end": None},
            {"country": "Ukraine", "end": "2024-01-01"},
        ]

        scoped = filter_conflicts_by_country(conflicts, "ukraine")
        self.assertEqual(len(scoped), 2)
        self.assertTrue(all(item["country"] == "Ukraine" for item in scoped))

    def test_no_country_returns_all_conflicts(self) -> None:
        conflicts = [{"country": "A"}, {"country": "B"}]
        self.assertEqual(filter_conflicts_by_country(conflicts, None), conflicts)


if __name__ == "__main__":
    unittest.main()
