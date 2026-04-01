import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

import { openDb, initDb } from './db.js'
import {
  generateBackupCode,
  generateToken,
  hashPassword,
  normalizeIdentifier,
  verifyPassword,
} from './auth.js'
import speakeasy from 'speakeasy'
import qrcode from 'qrcode'
import { authorize, PERMISSIONS } from './security.js'

const PORT = Number(process.env.PORT || 5000)
const SESSION_TTL_HOURS = 24

const db = openDb()
initDb(db)

const app = express()
app.use(helmet())

const configuredCorsOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const isDev = process.env.NODE_ENV !== 'production'
const isLocalViteOrigin = (origin) =>
  /^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}$/.test(String(origin || ''))

app.use(
  cors({
    origin(origin, cb) {
      // Allow non-browser clients (curl/postman) and same-origin requests.
      if (!origin) return cb(null, true)

      if (configuredCorsOrigins.length > 0) {
        return cb(null, configuredCorsOrigins.includes(origin))
      }

      // Dev default: allow Vite on any localhost port (5173, 5174, etc.).
      if (isDev && isLocalViteOrigin(origin)) return cb(null, true)

      return cb(null, false)
    },
    credentials: false,
  })
)
app.use(express.json({ limit: '200kb' }))
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
)

function nowIso() {
  return new Date().toISOString()
}

function addHoursISO(hours) {
  const d = new Date()
  d.setHours(d.getHours() + hours)
  return d.toISOString()
}

function getLoginAttempt(identifier) {
  return db
    .prepare('SELECT identifier, count, locked_until FROM login_attempts WHERE identifier = ?')
    .get(identifier)
}

function setLoginAttempt(identifier, count, lockedUntil) {
  db.prepare(
    `INSERT INTO login_attempts(identifier, count, locked_until)
     VALUES(?, ?, ?)
     ON CONFLICT(identifier) DO UPDATE SET count = excluded.count, locked_until = excluded.locked_until`
  ).run(identifier, count, lockedUntil)
}

function clearLoginAttempt(identifier) {
  db.prepare('DELETE FROM login_attempts WHERE identifier = ?').run(identifier)
}

function isLocked(identifier) {
  const row = getLoginAttempt(identifier)
  if (!row?.locked_until) return { locked: false }
  if (new Date(row.locked_until) > new Date()) return { locked: true, lockedUntil: row.locked_until }
  clearLoginAttempt(identifier)
  return { locked: false }
}

function recordFailed(identifier) {
  const MAX = 5
  const LOCK_MINUTES = 15
  const row = getLoginAttempt(identifier)
  const count = (row?.count || 0) + 1
  if (count >= MAX) {
    const d = new Date()
    d.setMinutes(d.getMinutes() + LOCK_MINUTES)
    setLoginAttempt(identifier, 0, d.toISOString())
    return { locked: true, lockedUntil: d.toISOString() }
  }
  setLoginAttempt(identifier, count, null)
  return { locked: false }
}

function findUserByLoginCredential(rawLogin) {
  const key = normalizeIdentifier(rawLogin)
  if (!key) return null
  return db
    .prepare(
      `SELECT id, role, identifier, student_id, email, full_name, password_hash, twofa_enabled, twofa_backup_code, twofa_secret,
              COALESCE(is_active, 1) AS is_active
       FROM users
       WHERE (role != 'student' AND identifier = ?)
          OR (role = 'student' AND (identifier = ? OR (email IS NOT NULL AND lower(trim(email)) = ?)))`,
    )
    .get(key, key, key)
}

function publicAuthUser(user) {
  if (!user) return null
  if (user.role === 'student') {
    return {
      role: user.role,
      identifier: user.identifier,
      studentId: user.student_id || user.identifier,
      email: user.email || '',
      fullName: user.full_name || '',
    }
  }
  return {
    role: user.role,
    identifier: user.identifier,
    fullName: user.full_name || '',
  }
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Missing token' })
  const session = db
    .prepare('SELECT token, user_id, expires_at FROM sessions WHERE token = ?')
    .get(token)
  if (!session) return res.status(401).json({ error: 'Invalid token' })
  if (new Date(session.expires_at) <= new Date()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
    return res.status(401).json({ error: 'Session expired' })
  }
  const user = db
    .prepare(
      `SELECT id, role, identifier, student_id, email, full_name, twofa_enabled, COALESCE(is_active, 1) AS is_active
       FROM users WHERE id = ?`,
    )
    .get(session.user_id)
  if (!user) return res.status(401).json({ error: 'User not found' })
  if (!user.is_active) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
    return res.status(401).json({ error: 'Account deactivated' })
  }
  req.user = user
  req.token = token
  next()
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

app.post('/api/auth/register', (req, res) => {
  const role = String(req.body?.role || '').trim()
  const password = String(req.body?.password || '')
  const fullName = String(req.body?.fullName || '').trim() || null
  const enable2FA = Boolean(req.body?.enable2FA)

  if (!['admin', 'student', 'faculty'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' })
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  let identifier
  let studentIdStored = null
  let emailStored = null
  let classSection = null
  let studentType = null

  if (role === 'student') {
    const studentIdRaw = String(req.body?.studentId ?? '').trim()
    const emailRaw = String(req.body?.email ?? '').trim()
    const studentIdNorm = normalizeIdentifier(studentIdRaw)
    const emailNorm = normalizeIdentifier(emailRaw)
    if (!studentIdRaw || studentIdNorm.length < 3) {
      return res.status(400).json({ error: 'Student ID must be at least 3 characters' })
    }
    if (!emailRaw || !emailNorm.includes('@')) {
      return res.status(400).json({ error: 'A valid email address is required' })
    }
    const dup = db
      .prepare(
        `SELECT id FROM users WHERE identifier = ?
           OR (email IS NOT NULL AND lower(trim(email)) = ?)
           OR (role = 'student' AND student_id IS NOT NULL AND lower(trim(student_id)) = ?)`,
      )
      .get(studentIdNorm, emailNorm, studentIdNorm)
    if (dup) return res.status(409).json({ error: 'Student ID or email is already in use' })

    identifier = studentIdNorm
    studentIdStored = studentIdRaw
    emailStored = emailNorm
    classSection = String(req.body?.classSection || '').trim() || null
    const st = String(req.body?.studentType || 'regular').toLowerCase()
    studentType = st === 'irregular' ? 'irregular' : 'regular'
  } else {
    identifier = normalizeIdentifier(req.body?.identifier)
    if (!identifier || identifier.length < 3) {
      return res.status(400).json({ error: 'Invalid identifier' })
    }
    const existing = db.prepare('SELECT id FROM users WHERE identifier = ?').get(identifier)
    if (existing) return res.status(409).json({ error: 'Account already exists' })
  }

  const passwordHash = hashPassword(password)
  const backupCode = enable2FA ? generateBackupCode() : null

  db.prepare(
    `INSERT INTO users(role, identifier, full_name, password_hash, twofa_enabled, twofa_backup_code, created_at, class_section, student_type, student_id, email, is_active)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
  ).run(
    role,
    identifier,
    fullName,
    passwordHash,
    enable2FA ? 1 : 0,
    backupCode,
    nowIso(),
    classSection,
    studentType,
    studentIdStored,
    emailStored,
  )

  return res.status(201).json({ ok: true, twoFABackupCode: backupCode })
})

app.post('/api/auth/login', (req, res) => {
  const identifier = normalizeIdentifier(req.body?.identifier)
  const password = String(req.body?.password || '')
  const twoFACode = String(req.body?.twoFACode || '').trim()

  if (!identifier || !password) return res.status(400).json({ error: 'Missing credentials' })

  const lock = isLocked(identifier)
  if (lock.locked) return res.status(429).json({ error: 'Locked', lockedUntil: lock.lockedUntil })

  const user = findUserByLoginCredential(req.body?.identifier)
  if (!user) {
    recordFailed(identifier)
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  if (!user.is_active) {
    return res.status(403).json({ error: 'This account has been deactivated' })
  }

  if (!verifyPassword(password, user.password_hash)) {
    const st = recordFailed(identifier)
    return res.status(st.locked ? 429 : 401).json({
      error: st.locked ? 'Locked' : 'Invalid credentials',
      lockedUntil: st.locked ? st.lockedUntil : undefined,
    })
  }

  if (user.twofa_enabled) {
    if (!twoFACode) return res.status(401).json({ error: 'Two-factor required' })
    
    // Check traditional backup code first
    let isValid = twoFACode === user.twofa_backup_code
    
    // Check TOTP code
    if (!isValid && user.twofa_secret) {
      isValid = speakeasy.totp.verify({
        secret: user.twofa_secret,
        encoding: 'base32',
        token: twoFACode,
      })
    }
    
    if (!isValid) return res.status(401).json({ error: 'Invalid 2FA code' })
  }

  clearLoginAttempt(identifier)

  const token = generateToken()
  db.prepare(
    'INSERT INTO sessions(token, user_id, created_at, expires_at) VALUES(?, ?, ?, ?)'
  ).run(token, user.id, nowIso(), addHoursISO(SESSION_TTL_HOURS))

  return res.json({
    ok: true,
    token,
    user: publicAuthUser(user),
  })
})

app.post('/api/auth/logout', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token)
  res.json({ ok: true })
})

app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ ok: true, user: req.user })
})

app.post('/api/auth/2fa/setup', authMiddleware, async (req, res) => {
  const secret = speakeasy.generateSecret({ name: `CCSDashboard (${req.user.identifier})` })
  db.prepare('UPDATE users SET twofa_secret = ? WHERE id = ?').run(secret.base32, req.user.id)
  
  try {
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url)
    res.json({ ok: true, secret: secret.base32, qrCode: qrCodeUrl })
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' })
  }
})

app.post('/api/auth/2fa/verify', authMiddleware, (req, res) => {
  const { code } = req.body
  if (!code) return res.status(400).json({ error: 'Missing code' })

  const user = db.prepare('SELECT twofa_secret FROM users WHERE id = ?').get(req.user.id)
  if (!user || !user.twofa_secret) {
    return res.status(400).json({ error: '2FA not set up' })
  }

  const isValid = speakeasy.totp.verify({
    secret: user.twofa_secret,
    encoding: 'base32',
    token: code,
  })

  if (isValid) {
    db.prepare('UPDATE users SET twofa_enabled = 1 WHERE id = ?').run(req.user.id)
    res.json({ ok: true })
  } else {
    res.status(401).json({ error: 'Invalid 2FA code' })
  }
})

app.get('/api/admin/users', authMiddleware, authorize(PERMISSIONS.MANAGE_USERS), (req, res) => {
  const users = db
    .prepare(
      `SELECT id, role, identifier, student_id, email, full_name, twofa_enabled, created_at,
              class_section, student_type, COALESCE(is_active, 1) AS is_active
       FROM users`,
    )
    .all()
  res.json({ ok: true, users })
})

app.get('/api/admin/users/:id', authMiddleware, authorize(PERMISSIONS.MANAGE_USERS), (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' })
  const user = db
    .prepare(
      `SELECT id, role, identifier, student_id, email, full_name, twofa_enabled, created_at,
              class_section, student_type, COALESCE(is_active, 1) AS is_active
       FROM users WHERE id = ?`,
    )
    .get(id)
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json({ ok: true, user })
})

app.patch('/api/admin/users/:id', authMiddleware, authorize(PERMISSIONS.MANAGE_USERS), (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' })
  const target = db.prepare('SELECT id, role FROM users WHERE id = ?').get(id)
  if (!target) return res.status(404).json({ error: 'User not found' })
  if (target.role !== 'student') {
    return res.status(400).json({ error: 'Only student accounts can be updated this way' })
  }
  if (typeof req.body?.isActive !== 'boolean') {
    return res.status(400).json({ error: 'Expected isActive boolean' })
  }
  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(req.body.isActive ? 1 : 0, id)
  const user = db
    .prepare(
      `SELECT id, role, identifier, student_id, email, full_name, twofa_enabled, created_at,
              class_section, student_type, COALESCE(is_active, 1) AS is_active
       FROM users WHERE id = ?`,
    )
    .get(id)
  res.json({ ok: true, user })
})

const MAX_PORT_TRIES = 20

function startListening(port, triesLeft) {
  const server = app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`API server listening on http://localhost:${port}`)
  })

  server.on('error', (err) => {
    if (err?.code === 'EADDRINUSE' && triesLeft > 0) {
      // eslint-disable-next-line no-console
      console.warn(`Port ${port} is in use. Trying ${port + 1}...`)
      server.close(() => startListening(port + 1, triesLeft - 1))
      return
    }

    // eslint-disable-next-line no-console
    console.error(err)
    process.exit(1)
  })
}

startListening(PORT, MAX_PORT_TRIES)

