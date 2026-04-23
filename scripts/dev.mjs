#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const node = process.execPath
const nextBin = resolve(rootDir, 'node_modules/.bin/next')
const tsxBin = resolve(rootDir, 'node_modules/.bin/tsx')

const tasks = [
  {
    label: 'design-tokens',
    cwd: resolve(rootDir, 'packages/design-tokens'),
    command: tsxBin,
    args: ['scripts/build-css.ts', '--watch'],
    persistent: false,
  },
  {
    label: 'api',
    cwd: resolve(rootDir, 'apps/api'),
    command: node,
    args: ['--env-file=../../.env.local', '--import', 'tsx', '--watch', 'src/server.ts'],
    persistent: true,
  },
  {
    label: 'admin',
    cwd: resolve(rootDir, 'apps/server'),
    command: node,
    args: ['--env-file=../../.env.local', nextBin, 'dev', '-p', '3001'],
    persistent: true,
  },
  {
    // CUTOVER（2026-04-23）：apps/web 退役，apps/web-next 升为对外入口 port 3000
    label: 'web-next',
    cwd: resolve(rootDir, 'apps/web-next'),
    command: node,
    args: ['--env-file=../../.env.local', nextBin, 'dev', '-p', '3000'],
    persistent: true,
  },
]

const children = new Map()
let shuttingDown = false

function log(message) {
  process.stderr.write(`[dev] ${message}\n`)
}

function startTask({ label, cwd, command, args, persistent }) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
  })

  children.set(child.pid, { child, label })

  child.on('exit', (code, signal) => {
    children.delete(child.pid)
    if (shuttingDown) return
    if (!persistent && code === 0) return
    if (signal === 'SIGINT' || signal === 'SIGTERM') {
      shutdown(0)
      return
    }

    const reason = signal ? `signal ${signal}` : `exit code ${code ?? 0}`
    log(`${label} stopped unexpectedly (${reason}); shutting down remaining dev services`)
    shutdown(code && code > 0 ? code : 1)
  })

  child.on('error', (error) => {
    children.delete(child.pid)
    if (shuttingDown) return

    log(`${label} failed to start: ${error.message}`)
    shutdown(1)
  })
}

function killChild({ child, label }, signal) {
  if (child.killed) return

  try {
    child.kill(signal)
  } catch (error) {
    if (error.code !== 'ESRCH') {
      log(`failed to send ${signal} to ${label}: ${error.message}`)
    }
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true

  log('stopping dev services')
  for (const entry of children.values()) {
    killChild(entry, 'SIGTERM')
  }

  const forceTimer = setTimeout(() => {
    for (const entry of children.values()) {
      killChild(entry, 'SIGKILL')
    }
  }, 3000)
  forceTimer.unref()

  const exitTimer = setTimeout(() => {
    process.exit(exitCode)
  }, 3500)
  exitTimer.unref()

  const checkTimer = setInterval(() => {
    if (children.size === 0) {
      clearInterval(checkTimer)
      process.exit(exitCode)
    }
  }, 100)
  checkTimer.unref()
}

process.once('SIGINT', () => shutdown(0))
process.once('SIGTERM', () => shutdown(0))
process.once('SIGHUP', () => shutdown(0))

for (const task of tasks) {
  startTask(task)
}
