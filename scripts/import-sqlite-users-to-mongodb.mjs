import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { MongoClient } from 'mongodb'
import { initDb } from '../server/db.js'

function normalizeForMongoIdentifier(value) {
  return String(value || '').trim().toLowerCase()
}

function getMongoDbName(mongoUri) {
  const explicit = String(process.env.MONGODB_DB || '').trim()
  if (explicit) return explicit

  try {
    const u = new URL(mongoUri)
    const pathname = u.pathname || ''
    const maybeName = pathname.replace(/^\//, '').trim()
    if (maybeName) return maybeName
  } catch {
    // ignore
  }
  return null
}

const SQLITE_PATH =
  process.argv.find((a) => a.startsWith('--sqlitePath='))?.split('=')[1] ||
  path.join(process.cwd(), 'data', 'app.sqlite')

const mongoUri = String(process.env.MONGODB_URI || '').trim()
if (!mongoUri) {
  throw new Error('Missing MONGODB_URI env var (required).')
}

const dbName = getMongoDbName(mongoUri)
if (!dbName) {
  throw new Error('Missing MONGODB_DB env var (or a db name in MONGODB_URI pathname).')
}

if (!fs.existsSync(SQLITE_PATH)) {
  throw new Error(`SQLite file not found: ${SQLITE_PATH}`)
}

console.log(`Importing users from SQLite: ${SQLITE_PATH}`)

const sqlite = new Database(SQLITE_PATH)
// Ensure the SQLite schema is up to date before copying rows.
// This also applies legacy identifier migrations used by the app.
initDb(sqlite)

const usersRows = sqlite
  .prepare(
    `SELECT id, role, identifier, full_name, password_hash, twofa_enabled, twofa_backup_code, twofa_secret,
            created_at, class_section, student_type, student_id, email, is_active
     FROM users`,
  )
  .all()

const maxId = usersRows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0)
console.log(`Found ${usersRows.length} user(s). max id = ${maxId}`)

const client = new MongoClient(mongoUri)
await client.connect()
const db = client.db(dbName)

const users = db.collection('users')
const counters = db.collection('counters')

// Mirror the indexes our app uses, so uniqueness matches runtime behavior.
await Promise.all([
  users.createIndex({ identifier: 1 }, { unique: true, name: 'users_identifier_unique' }),
  users.createIndex({ id: 1 }, { unique: true, name: 'users_id_unique' }),
  users.createIndex(
    { email: 1 },
    {
      unique: true,
      name: 'users_email_unique',
      partialFilterExpression: { email: { $type: 'string' } },
    },
  ),
])

for (const r of usersRows) {
  const doc = {
    id: Number(r.id),
    role: r.role,
    identifier: r.identifier,
    full_name: r.full_name ?? null,
    password_hash: r.password_hash,
    twofa_enabled: r.twofa_enabled ? 1 : 0,
    twofa_backup_code: r.twofa_backup_code ?? null,
    twofa_secret: r.twofa_secret ?? null,
    created_at: r.created_at,
    class_section: r.class_section ?? null,
    student_type: r.student_type ?? null,
    student_id: r.student_id ?? null,
    email: r.email ?? null,
    is_active: r.is_active === undefined ? 1 : r.is_active ? 1 : 0,
  }

  if (doc.role === 'student') {
    const sidNorm = r.student_id ? normalizeForMongoIdentifier(r.student_id) : null
    doc.student_id_norm = sidNorm
  }

  await users.updateOne({ id: doc.id }, { $set: doc }, { upsert: true })
}

// Ensure the next generated ids start after the current max.
await counters.updateOne({ _id: 'users' }, { $set: { seq: maxId } }, { upsert: true })

console.log('Migration complete.')
await client.close()

