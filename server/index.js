import express from 'express'
import fs from 'node:fs/promises'
import fetch from 'node-fetch'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '..', '.env') })

console.log('GEMINI loaded:', !!process.env.GEMINI_API_KEY)
console.log('DEEPSEEK loaded:', !!process.env.DEEPSEEK_API_KEY)

const conflictsPath = path.join(
  __dirname,
  '..',
  'client',
  'public',
  'data',
  'conflicts.json'
)

const suggestedConflictsPath = path.join(
  __dirname,
  '..',
  'client',
  'public',
  'data',
  'conflicts.suggested.json'
)

const app = express()
const PORT = 3001

/**
 * Read the current main conflict dataset used by the map.
 */
async function readConflicts() {
  const raw = await fs.readFile(conflictsPath, 'utf-8')
  return JSON.parse(raw)
}

/**
 * Gemini often returns JSON wrapped in markdown fences.
 * This helper strips code fences and returns raw JSON text.
 */
function extractJsonText(aiResponse) {
  const text =
    aiResponse?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

/**
 * Normalize the AI response into the shape expected by the frontend.
 * For now we keep it conservative:
 * - require country and opponent
 * - preserve start if present
 * - default end to null
 */
function normalizeConflicts(items) {
  if (!Array.isArray(items)) return []

  return items
    .filter((item) => item && item.country && item.opponent)
    .map((item) => ({
      country: String(item.country).trim(),
      opponent: String(item.opponent).trim(),
      start: item.start ? String(item.start).trim() : null,
      end: null
    }))
}

/**
 * Basic root endpoint for quick server sanity checks.
 */
app.get('/', (_req, res) => {
  res.json({
    message: 'Global War Tracker API is running',
    endpoints: ['/api/conflicts', '/api/update-conflicts']
  })
})

/**
 * Existing conflict data endpoint used by the frontend map.
 */
app.get('/api/conflicts', async (_req, res) => {
  try {
    const conflicts = await readConflicts()
    res.json(conflicts)
  } catch (error) {
    console.error('Failed to read conflicts JSON:', error)
    res.status(500).json({ message: 'Failed to load conflicts.' })
  }
})

/**
 * AI-assisted conflict refresh.
 *
 * Current behavior:
 * 1. Ask Gemini for a strict JSON array
 * 2. Extract and parse the JSON
 * 3. Normalize it
 * 4. Save it to conflicts.suggested.json
 *
 * We intentionally do NOT overwrite conflicts.json yet.
 */
app.get('/api/update-conflicts', async (_req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is missing' })
    }

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `
Return ONLY a strict JSON array.
Do NOT use markdown.
Do NOT use code fences.
Do NOT add explanations.

Each item must contain:
- country
- opponent
- start

Format example:
[
  {
    "country": "Ukraine",
    "opponent": "Russia",
    "start": "2022-02-24"
  }
]

List current world military conflicts.
                  `.trim()
                }
              ]
            }
          ]
        })
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('Gemini error:', data)
      return res.status(response.status).json(data)
    }

    const rawText = extractJsonText(data)
    const parsed = JSON.parse(rawText)
    const normalized = normalizeConflicts(parsed)

    await fs.writeFile(
      suggestedConflictsPath,
      JSON.stringify(normalized, null, 2),
      'utf-8'
    )

    res.json({
      message: 'Suggested conflicts saved',
      count: normalized.length,
      file: 'client/public/data/conflicts.suggested.json',
      conflicts: normalized
    })
  } catch (error) {
    console.error('AI request failed:', error)
    res.status(500).json({ error: 'AI request failed' })
  }
})
app.post('/api/apply-conflicts', async (_req, res) => {
  try {
    const raw = await fs.readFile(suggestedConflictsPath, 'utf-8')
    await fs.writeFile(conflictsPath, raw, 'utf-8')

    res.json({
      message: 'Suggested conflicts applied',
      file: 'client/public/data/conflicts.json'
    })
  } catch (error) {
    console.error('Failed to apply suggested conflicts:', error)
    res.status(500).json({ error: 'Failed to apply suggested conflicts' })
  }
})
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})