import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const conflictsPath = path.join(
  __dirname,
  '..',
  'client',
  'public',
  'data',
  'conflicts.json'
)

const app = express()
const PORT = 3001

// Read conflicts file
async function readConflicts() {
  const raw = await fs.readFile(conflictsPath, 'utf-8')
  return JSON.parse(raw)
}

// API endpoint
app.get('/api/conflicts', async (_req, res) => {
  try {
    const conflicts = await readConflicts()
    res.json(conflicts)
  } catch (error) {
    console.error('Error reading conflicts:', error)
    res.status(500).json({ message: 'Failed to read conflicts data.' })
  }
})

// root route (чтобы не было Cannot GET /)
app.get('/', (_req, res) => {
  res.send('Global War Tracker API running')
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
