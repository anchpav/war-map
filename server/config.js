import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env from repository root, not from the server folder.
dotenv.config({ path: path.resolve(__dirname, '../.env') })

export const config = {
  port: process.env.PORT || 3001,
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || ''
}
