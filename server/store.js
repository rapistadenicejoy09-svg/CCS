import { openSqliteStore } from './store-sqlite.js'
import { openMongoStore } from './store-mongo.js'

export async function openStore() {
  const providerRaw = String(process.env.DB_PROVIDER || 'sqlite')
  const provider = providerRaw.trim().toLowerCase()

  if (provider === 'mongodb' || provider === 'mongo' || provider === 'atlas') {
    return await openMongoStore()
  }

  return openSqliteStore()
}

