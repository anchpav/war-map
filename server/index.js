import express from 'express'
import cors from 'cors'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from './config.js'
import { updateConflictData } from './services/aiService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const conflictsPath = path.join(__dirname, '..', 'client', 'public', 'data', 'conflicts.json')

const app = express()
app.use(cors())
app.use(express.json())

async function readConflicts() {
  const raw = await fs.readFile(conflictsPath, 'utf-8')
  return JSON.parse(raw).conflicts
}

function calculateDaysWithoutWar(conflicts, selectedCountry) {
  const scoped = selectedCountry
    ? conflicts.filter((conflict) =>
        conflict.countries.some((country) => country.toLowerCase() === selectedCountry.toLowerCase())
      )
    : conflicts

  if (scoped.length === 0) return 0
  if (scoped.some((conflict) => conflict.active)) return 0

  const ended = scoped.map((conflict) => conflict.end_date).filter(Boolean)
  if (ended.length === 0) return 0

  const mostRecent = ended.sort((a, b) => b.localeCompare(a))[0]
  const diffMs = Date.now() - new Date(mostRecent).getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

app.get('/api/conflicts', async (_req, res) => {
  const conflicts = await readConflicts()
  res.json({ conflicts })
})

app.get('/api/metrics', async (req, res) => {
  const conflicts = await readConflicts()
  const country = req.query.country || ''

  const scoped = country
    ? conflicts.filter((conflict) =>
        conflict.countries.some((name) => name.toLowerCase() === String(country).toLowerCase())
      )
    : conflicts

  res.json({
    totalConflicts: scoped.length,
    activeConflicts: scoped.filter((conflict) => conflict.active).length,
    daysWithoutWarWorld: calculateDaysWithoutWar(conflicts),
    daysWithoutWarSelected: calculateDaysWithoutWar(conflicts, String(country || ''))
  })
})

app.post('/api/update-conflicts', async (_req, res) => {
  const result = await updateConflictData()
  res.json({ status: 'ok', message: result.message })
})

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`)
})
