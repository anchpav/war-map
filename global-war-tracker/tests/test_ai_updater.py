"""Unit tests for AI updater provider fallback and merge behavior."""

from unittest.mock import patch
import unittest

from backend.ai_updater import analyze_headlines_with_ai, convert_analysis_to_conflicts, merge_new_conflicts


class TestAiUpdater(unittest.TestCase):
    def test_convert_analysis_stable_id(self) -> None:
        analysis = [
            {
                "is_conflict": True,
                "country": "Ukraine",
                "opponent": "Russia",
                "description": "Interstate war",
                "possible_start_date": "2022-02-24",
            }
        ]

        first_id = convert_analysis_to_conflicts(analysis)[0]["id"]
        second_id = convert_analysis_to_conflicts(analysis)[0]["id"]
        self.assertEqual(first_id, second_id)

    def test_merge_new_conflicts_skips_duplicates(self) -> None:
        existing = [{"id": "a1", "country": "A"}]
        incoming = [{"id": "a1", "country": "A"}, {"id": "b2", "country": "B"}]
        merged = merge_new_conflicts(existing, incoming)

        self.assertEqual(len(merged), 2)
        self.assertEqual({row["id"] for row in merged}, {"a1", "b2"})

    def test_ai_falls_back_to_mock_when_api_requests_fail(self) -> None:
        headlines = ["Missile attack reported near border city"]

        with patch("backend.ai_updater._analyze_with_deepseek", side_effect=RuntimeError("boom")), patch(
            "backend.ai_updater._analyze_with_gemini", side_effect=RuntimeError("boom")
        ), patch.dict("os.environ", {"DEEPSEEK_API_KEY": "x", "GEMINI_API_KEY": "y"}):
            analysis, provider = analyze_headlines_with_ai(headlines)

        self.assertEqual(provider, "mock")
        self.assertTrue(analysis)
        self.assertTrue(analysis[0]["is_conflict"])


if __name__ == "__main__":
    unittest.main()
