"""Unit tests for updater conversion and merge logic."""

from unittest.mock import MagicMock, patch
import unittest

from backend import ai_updater
from backend.ai_updater import (
    analyze_headlines_with_openai,
    convert_analysis_to_conflicts,
    merge_new_conflicts,
)


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

    def test_convert_analysis_id_is_stable_and_does_not_include_today_date(self) -> None:
        analysis = [
            {
                "is_conflict": True,
                "country": "Ukraine",
                "description": "Escalation near border city",
                "possible_start_date": "2026-01-01",
            }
        ]

        first = convert_analysis_to_conflicts(analysis)[0]["id"]
        second = convert_analysis_to_conflicts(analysis)[0]["id"]

        self.assertEqual(first, second)
        self.assertNotIn(str(ai_updater.date.today()), first)

    def test_merge_skips_existing_ids(self) -> None:
        existing = [{"id": "x1", "name": "A"}]
        incoming = [{"id": "x1", "name": "A2"}, {"id": "x2", "name": "B"}]

        merged = merge_new_conflicts(existing, incoming)
        self.assertEqual(len(merged), 2)
        self.assertEqual({r["id"] for r in merged}, {"x1", "x2"})

    def test_openai_error_falls_back_to_mock_mode(self) -> None:
        headlines = ["War erupts in RegionX"]

        fake_client = MagicMock()
        fake_client.responses.create.side_effect = RuntimeError("network down")

        with patch("backend.ai_updater.OpenAI", return_value=fake_client), patch.dict(
            "os.environ", {"OPENAI_API_KEY": "test-key"}
        ):
            result = analyze_headlines_with_openai(headlines)

        self.assertTrue(result)
        self.assertTrue(result[0]["is_conflict"])


if __name__ == "__main__":
    unittest.main()
