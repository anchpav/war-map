import express from "express"
import cors from "cors"
import fs from "fs"
import path from "path"

const app = express()
const PORT = 3000

app.use(cors())
app.use(express.json())

// path to conflicts data
const dataPath = path.join(__dirname, "../client/public/data/conflicts.json")

// API endpoint for conflicts
app.get("/api/conflicts", (req, res) => {
  try {
    const raw = fs.readFileSync(dataPath)
    const data = JSON.parse(raw)
    res.json(data)
  } catch (err) {
    console.error("Failed to read conflicts:", err)
    res.status(500).json({ error: "Failed to load conflicts" })
  }
})

// simple health check
app.get("/", (req, res) => {
  res.send("War Map API running")
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
