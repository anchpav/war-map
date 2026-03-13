import crypto from 'node:crypto'
import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const conflictsPath = path.join(__dirname, '..', 'client', 'public', 'data', 'conflicts.json')

const app = express()
const PORT = 3001

const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase()
const ADMIN_SESSION_SECRET = String(process.env.ADMIN_SESSION_SECRET || 'dev-admin-secret')
const CODE_TTL_MS = 10 * 60 * 1000
const SESSION_TTL_MS = 2 * 60 * 60 * 1000

const pendingCodes = new Map()
const adminSessions = new Map()

app.use(express.json())

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

function cleanupExpired() {
  const now = Date.now()

  for (const [email, entry] of pendingCodes.entries()) {
    if (entry.expiresAt <= now) pendingCodes.delete(email)
  }

  for (const [token, entry] of adminSessions.entries()) {
    if (entry.expiresAt <= now) adminSessions.delete(token)
  }
}

function resolveAdminSession(req) {
  cleanupExpired()

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

async function sendAdminCodeEmail(email, code) {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration missing. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.')
  }

  const nodemailer = await import('nodemailer')
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  })

  await transporter.sendMail({
    from: user,
    to: email,
    subject: 'Global War Tracker admin code',
    text: `Your admin verification code is ${code}. It expires in 10 minutes.`
  })
}

/**
 * Read conflicts from client/public/data/conflicts.json.
 * Keeping file access in one function keeps endpoint code simple.
 */
async function readConflicts() {
  const raw = await fs.readFile(conflictsPath, 'utf-8')
  return JSON.parse(raw)
}

app.get('/api/conflicts', async (_req, res) => {
  try {
    const conflicts = await readConflicts()
    res.json(conflicts)
  } catch (error) {
    console.error('Failed to read conflicts JSON:', error)
    res.status(500).json({ message: 'Failed to load conflicts.' })
  }
})

app.post('/api/admin/request-code', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase()
    if (!email || !ADMIN_EMAIL || email !== ADMIN_EMAIL) {
      res.status(403).json({ message: 'Unauthorized admin email.' })
      return
    }

    const code = String(crypto.randomInt(100000, 1000000))
    pendingCodes.set(email, { code, expiresAt: Date.now() + CODE_TTL_MS })

    await sendAdminCodeEmail(email, code)
    res.json({ success: true })
  } catch (error) {
    console.error('Failed to request admin code:', error)
    res.status(500).json({ message: 'Failed to send admin code.' })
  }
})

app.post('/api/admin/verify-code', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const code = String(req.body?.code || '').trim()

  if (!email || !code || !ADMIN_EMAIL || email !== ADMIN_EMAIL) {
    res.status(403).json({ message: 'Unauthorized admin verification request.' })
    return
  }

  cleanupExpired()
  const pending = pendingCodes.get(email)
  if (!pending || pending.code !== code || pending.expiresAt <= Date.now()) {
    res.status(401).json({ message: 'Invalid or expired code.' })
    return
  }

  pendingCodes.delete(email)

  const signedToken = createSessionToken()
  const token = verifySessionToken(signedToken)
  adminSessions.set(token, { email, expiresAt: Date.now() + SESSION_TTL_MS })

  setSessionCookie(res, signedToken)
  res.json({ success: true })
})

app.get('/api/admin/status', (req, res) => {
  const session = resolveAdminSession(req)
  res.json({ isAdmin: Boolean(session) })
})

app.post('/api/admin/logout', (req, res) => {
  const session = resolveAdminSession(req)
  if (session) adminSessions.delete(session.token)
  clearSessionCookie(res)
  res.json({ success: true })
})

app.get('/api/update-conflicts', requireAdmin, async (_req, res) => {
  res.status(501).json({ message: 'AI update trigger is not wired in this lightweight server build.' })
})

app.post('/api/apply-conflicts', requireAdmin, async (_req, res) => {
  res.status(501).json({ message: 'AI apply trigger is not wired in this lightweight server build.' })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
