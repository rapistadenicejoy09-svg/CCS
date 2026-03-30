import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const PORT = Number(process.env.PORT || 5000)
const healthUrl = `http://localhost:${PORT}/api/health`

let serverProcess = null
let viteProcess = null

function spawnProcess(command, args, options) {
  const child = spawn(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
    ...options,
  })
  child.on('exit', (code) => {
    // If one process exits unexpectedly, stop the other so the dev environment doesn't hang.
    if (code !== 0) {
      if (serverProcess && serverProcess.pid && serverProcess.pid !== child.pid) serverProcess.kill()
      if (viteProcess && viteProcess.pid && viteProcess.pid !== child.pid) viteProcess.kill()
    }
  })
  return child
}

async function waitForBackendReady(timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(healthUrl, { method: 'GET' })
      if (res.ok) return
    } catch {
      // ignore until backend is up
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`Backend did not start. Expected ${healthUrl} to respond.`)
}

async function isBackendUp() {
  try {
    const res = await fetch(healthUrl, { method: 'GET' })
    return res.ok
  } catch {
    return false
  }
}

const serverEntry = path.join(rootDir, 'server', 'index.js')
const viteBin = path.join(
  rootDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'vite.cmd' : 'vite'
)

async function main() {
  if (!(await isBackendUp())) {
    serverProcess = spawnProcess(process.execPath, [serverEntry])
    await waitForBackendReady()
  }

  viteProcess = spawnProcess(viteBin, [], process.platform === 'win32' ? { shell: true } : {})
}

function shutdown() {
  if (viteProcess && !viteProcess.killed) viteProcess.kill()
  if (serverProcess && !serverProcess.killed) serverProcess.kill()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
process.on('exit', shutdown)

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  shutdown()
  process.exit(1)
})

