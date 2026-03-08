/**
 * Placeholder AI service for future provider integrations.
 * Keep this simple and safe for MVP use.
 */

export async function fetchConflictSummary() {
  // TODO: Integrate DeepSeek/Gemini headline analysis.
  return {
    provider: 'stub',
    summary: 'AI summary placeholder. Integrate real providers later.'
  }
}

export async function updateConflictData() {
  // TODO: Read RSS/news, analyze with AI, and write to conflicts.json.
  return {
    updated: false,
    message: 'Stub update completed. No changes applied.'
  }
}
