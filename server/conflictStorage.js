import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDir = path.join(__dirname, '..', 'client', 'public', 'data')
const conflictsFile = path.join(dataDir, 'conflicts.json')
const suggestedFile = path.join(dataDir, 'conflicts.suggested.json')

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

function isValidConflict(conflict) {
  return Boolean(conflict.country) && Boolean(conflict.opponent)
}

function dedupeConflicts(conflicts) {
  const seen = new Set()
  const result = []

  for (const conflict of conflicts) {
    const normalized = normalizeConflict(conflict)
    if (!isValidConflict(normalized)) continue

    const key = [
      normalized.country.toLowerCase(),
      normalized.opponent.toLowerCase(),
      normalized.opponentType,
      normalized.start || '',
      normalized.end || ''
    ].join('|')

    if (seen.has(key)) continue
    seen.add(key)
    result.push(normalized)
  }

  return result
}

export async function readConflictsFromDisk() {
  const raw = await fs.readFile(conflictsFile, 'utf-8')
  const parsed = JSON.parse(raw)
  return Array.isArray(parsed) ? dedupeConflicts(parsed) : []
}

export async function writeSuggestedConflicts(conflicts) {
  const clean = dedupeConflicts(conflicts)
  await fs.writeFile(suggestedFile, JSON.stringify(clean, null, 2) + '\n', 'utf-8')
  return clean
}

export async function readSuggestedConflicts() {
  try {
    const raw = await fs.readFile(suggestedFile, 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? dedupeConflicts(parsed) : []
  } catch {
    return []
  }
}

export async function applySuggestedConflicts() {
  const suggested = await readSuggestedConflicts()
  if (!suggested.length) {
    throw new Error('No suggested conflicts to apply.')
  }

  await fs.writeFile(conflictsFile, JSON.stringify(suggested, null, 2) + '\n', 'utf-8')
  return suggested
}
