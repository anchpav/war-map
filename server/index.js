import crypto from 'node:crypto'
import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

import { detectConflictsWithGemini } from './aiConflictService.js'
import {
  applySuggestedConflicts,
  readSuggestedConflicts,
  writeSuggestedConflicts
} from './conflictStorage.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '..', '.env') })

const conflictsPath = path.join(__dirname, '..', 'client', 'public', 'data', 'conflicts.json')

const app = express()
const PORT = Number(process.env.PORT || 3001)

const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase()
const ADMIN_SESSION_SECRET = String(process.env.ADMIN_SESSION_SECRET || 'dev-admin-secret')

const CODE_TTL_MS = 10 * 60 * 1000
const SESSION_TTL_MS = 2 * 60 * 60 * 1000

const pendingCodes = new Map()
const adminSessions = new Map()

app.use(express.json())

console.log('ADMIN_EMAIL loaded:', ADMIN_EMAIL || '(empty)')

function getCookie(req, name) {
  const raw = req.headers.cookie
  if (!raw) return ''
  const pairs = raw.split(';').map((part) => part.trim())
  const found = pairs.find((part) => part.startsWith(`${name}=`))
  if (!found) return ''
  return decodeURIComponent(found.slice(name.length + 1))
}

function signToken(token) {
  return crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(token).digest('hex')
}

function createSessionToken() {
  const token = crypto.randomBytes(24).toString('hex')
  return `${token}.${signToken(token)}`
}

function verifySessionToken(value) {
  const [token, signature] = String(value || '').split('.')
  if (!token || !signature) return ''
  const expected = signToken(token)

  try {
    const a = Buffer.from(signature)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return ''
    return crypto.timingSafeEqual(a, b) ? token : ''
  } catch {
    return ''
  }
}

function setSessionCookie(res, signedToken) {
  res.setHeader(
    'Set-Cookie',
    `admin_session=${encodeURIComponent(signedToken)}; HttpOnly; Path=/; Max-Age=${Math.floor(
      SESSION_TTL_MS / 1000
    )}; SameSite=Strict`
  )
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'admin_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict')
}

function resolveAdminSession(req) {
  const signedToken = getCookie(req, 'admin_session')
  const token = verifySessionToken(signedToken)

  if (!token) return null

  const session = adminSessions.get(token)
  if (!session || session.expiresAt <= Date.now()) {
    adminSessions.delete(token)
    return null
  }

  return { token, ...session }
}

function requireAdmin(req, res, next) {
  const session = resolveAdminSession(req)

  if (!session) {
    res.status(401).json({ message: 'Admin session required.' })
    return
  }

  req.adminSession = session
  next()
}

async function readConflicts() {
  const raw = await fs.readFile(conflictsPath, 'utf-8')
  const parsed = JSON.parse(raw)
  return Array.isArray(parsed) ? parsed : []
}

app.get('/', (_req, res) => {
  res.json({
    message: 'Global War Tracker API is running',
    endpoints: [
      '/api/conflicts',
      '/api/admin/request-code',
      '/api/admin/verify-code',
      '/api/admin/status',
      '/api/update-conflicts',
      '/api/apply-conflicts'
    ]
  })
})

app.get('/api/conflicts', async (_req, res) => {
  const conflicts = await readConflicts()
  res.json(conflicts)
})

app.get('/api/update-conflicts', requireAdmin, async (_req, res) => {
  const detection = await detectConflictsWithGemini()
  const suggested = await writeSuggestedConflicts(detection.conflicts)

  res.json({
    mode: 'preview',
    sourceCount: detection.sourceCount,
    suggestedCount: suggested.length
  })
})

app.post('/api/apply-conflicts', requireAdmin, async (_req, res) => {
  const applied = await applySuggestedConflicts()

  res.json({
    mode: 'applied',
    appliedCount: applied.length
  })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
