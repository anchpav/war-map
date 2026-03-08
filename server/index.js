import express from "express"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// абсолютный путь к conflicts.json
const conflictsPath = path.resolve(
  __dirname,
  "../client/public/data/conflicts.json"
)

const app = express()
const PORT = 3001

// читаем файл конфликтов
async function readConflicts() {
  try {
    const raw = await fs.readFile(conflictsPath, "utf-8")
    return JSON.parse(raw)
  } catch (error) {
    console.error("Error reading conflicts.json:", error)
    throw error
  }
}

// API endpoint
app.get("/api/conflicts", async (req, res) => {
  try {
    const conflicts = await readConflicts()
    res.json(conflicts)
  } catch (error) {
    res.status(500).json({
      message: "Failed to read conflicts data"
    })
  }
})

// root route
app.get("/", (req, res) => {
  res.send("Global War Tracker API running")
})

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
  console.log("Conflicts file:", conflictsPath)
})
