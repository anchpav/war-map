const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

function normalizeOpponentType(value) {
  return value === 'non-state' || value === 'proxy' ? value : 'state'
}

function normalizeDate(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  const trimmed = value.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null
}

function normalizeConflict(raw) {
  return {
    country: String(raw?.country || '').trim(),
    opponent: String(raw?.opponent || '').trim(),
    opponentType: normalizeOpponentType(raw?.opponentType),
    start: normalizeDate(raw?.start),
    end: normalizeDate(raw?.end)
  }
}

function extractJsonArray(text) {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start < 0 || end < 0 || end <= start) return []

  try {
    const parsed = JSON.parse(text.slice(start, end + 1))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}


function parseGeminiJson(text) {
  try {
    const direct = JSON.parse(text)
    if (Array.isArray(direct)) return direct
  } catch {
    // Fall through to array extraction fallback.
  }

  return extractJsonArray(text)
}

function dedupeConflicts(conflicts) {
  const seen = new Set()
  const result = []

  for (const conflict of conflicts.map(normalizeConflict)) {
    if (!conflict.country || !conflict.opponent) continue

    const key = [
      conflict.country.toLowerCase(),
      conflict.opponent.toLowerCase(),
      conflict.opponentType,
      conflict.start || '',
      conflict.end || ''
    ].join('|')

    if (seen.has(key)) continue
    seen.add(key)
    result.push(conflict)
  }

  return result
}

async function fetchHeadlines(limit = 25) {
  const feeds = [
    'https://feeds.bbci.co.uk/news/world/rss.xml',
    'https://www.aljazeera.com/xml/rss/all.xml',
    'https://rss.nytimes.com/services/xml/rss/nyt/World.xml'
  ]

  const headlines = []

  for (const feed of feeds) {
    try {
      const response = await fetch(feed)
      if (!response.ok) continue
      const xml = await response.text()
      const matches = [...xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/gi)]
      for (const match of matches) {
        const title = (match[1] || match[2] || '').trim()
        if (!title || /^(BBC|Al Jazeera|NYT|World)$/i.test(title)) continue
        headlines.push(title)
        if (headlines.length >= limit) return headlines
      }
    } catch {
      // Ignore feed-level failure and continue with next source.
    }
  }

  return headlines
}

export async function detectConflictsWithGemini() {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim()
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY.')
  }

  const headlines = await fetchHeadlines(25)
  if (!headlines.length) {
    return {
      conflicts: [],
      sourceCount: 0,
      rawTextLength: 0,
      extractedCount: 0,
      rawPreview: ''
    }
  }

  const prompt = [
    'You extract armed conflict records from headlines.',
    'Output must be STRICT JSON only.',
    'Return exactly one JSON array and nothing else (no markdown, no prose, no code fences).',
    'Each item must have keys: country, opponent, opponentType, start, end.',
    'Allowed opponentType values: state, non-state, proxy.',
    'If date is unknown, use null for start/end.',
    'If no valid conflicts are present, return [] exactly.',
    '',
    'Headlines:',
    ...headlines.map((h) => `- ${h}`)
  ].join('\n')

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 3000,
        responseMimeType: 'application/json'
      }
    })
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Gemini request failed: ${response.status} ${body.slice(0, 200)}`)
  }

  const payload = await response.json()
  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join('\n') || ''

  // Temporary debug logging for extraction troubleshooting.
  console.debug('[AI][Gemini raw output]', text)

  const extracted = parseGeminiJson(text)
  const conflicts = dedupeConflicts(extracted)

  return {
    conflicts,
    sourceCount: headlines.length,
    rawTextLength: text.length,
    extractedCount: conflicts.length,
    rawPreview: text.slice(0, 300)
  }
}
