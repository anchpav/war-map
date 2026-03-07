import dotenv from 'dotenv'

dotenv.config()

export const config = {
  port: process.env.PORT || 3001,
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || ''
}
