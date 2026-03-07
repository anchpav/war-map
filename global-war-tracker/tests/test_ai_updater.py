"""Unit tests for updater conversion and merge logic."""

import unittest

from backend.ai_updater import convert_analysis_to_conflicts, merge_new_conflicts


class TestAiUpdaterHelpers(unittest.TestCase):
    def test_convert_analysis_generates_unique_ids_for_different_descriptions(self) -> None:
        analysis = [
            {
                "is_conflict": True,
                "country": "Unknown",
                "description": "Headline one",
                "possible_start_date": "2026-01-01",
            },
            {
                "is_conflict": True,
                "country": "Unknown",
                "description": "Headline two",
                "possible_start_date": "2026-01-01",
            },
        ]

        records = convert_analysis_to_conflicts(analysis)
        self.assertEqual(len(records), 2)
        self.assertNotEqual(records[0]["id"], records[1]["id"])

    def test_merge_skips_existing_ids(self) -> None:
        existing = [{"id": "x1", "name": "A"}]
        incoming = [{"id": "x1", "name": "A2"}, {"id": "x2", "name": "B"}]

        merged = merge_new_conflicts(existing, incoming)
        self.assertEqual(len(merged), 2)
        self.assertEqual({r["id"] for r in merged}, {"x1", "x2"})


if __name__ == "__main__":
    unittest.main()
