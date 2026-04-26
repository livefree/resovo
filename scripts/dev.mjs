#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, renameSync, statSync, readdirSync, unlinkSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { createInterface } from 'node:readline'
import process from 'node:process'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const node = process.execPath
const nextBin = resolve(rootDir, 'node_modules/.bin/next')
const tsxBin = resolve(rootDir, 'node_modules/.bin/tsx')

const LOG_DIR = process.env.LOG_DIR ?? resolve(rootDir, 'logs')
const LOG_MAX_BYTES = Number(process.env.LOG_MAX_BYTES ?? 10 * 1024 * 1024) // 10MB
const LOG_MAX_FILES = Number(process.env.LOG_MAX_FILES ?? 5)
const LOG_RETENTION_DAYS = Number(process.env.LOG_RETENTION_DAYS ?? 7)

const DEV_DIR = join(LOG_DIR, 'dev')
const ERRORS_DIR = join(LOG_DIR, 'errors')
const CLIENT_DIR = join(LOG_DIR, 'client')

// ANSI 颜色前缀，每个 service 不同颜色
const SERVICE_COLORS = {
  'design-tokens': '\x1b[36m', // cyan
  'api': '\x1b[32m',           // green
  'admin': '\x1b[35m',         // magenta
  'web-next': '\x1b[34m',      // blue
  'dev': '\x1b[33m',           // yellow
}
const RESET = '\x1b[0m'

// 保守前缀：非 JSON stderr 行匹配后才写入 errors
const ERROR_PREFIXES = ['Error:', 'Warning:', '[ERR]', '[WARN]', 'FATAL:', 'Uncaught']

function ensureDirs() {
  for (const dir of [DEV_DIR, ERRORS_DIR, CLIENT_DIR]) {
    mkdirSync(dir, { recursive: true })
  }
}

function devLog(message) {
  const color = SERVICE_COLORS['dev'] ?? ''
  process.stderr.write(`${color}[dev]${RESET} ${message}\n`)
}

// rotate 单文件：service.log → service.log.1 .. .5，超出删除
function rotateFile(filePath) {
  if (!existsSync(filePath)) return
  try {
    const oldest = `${filePath}.${LOG_MAX_FILES}`
    if (existsSync(oldest)) unlinkSync(oldest)
    for (let i = LOG_MAX_FILES - 1; i >= 1; i--) {
      const from = `${filePath}.${i}`
      const to = `${filePath}.${i + 1}`
      if (existsSync(from)) renameSync(from, to)
    }
    renameSync(filePath, `${filePath}.1`)
  } catch {
    // rotate 失败不阻断主流程
  }
}

// 检查文件大小，超阈值时 rotate
function checkRotate(filePath) {
  try {
    if (existsSync(filePath) && statSync(filePath).size >= LOG_MAX_BYTES) {
      rotateFile(filePath)
    }
  } catch {
    // 忽略 stat 失败
  }
}

// 按日期清理过期 client / errors 文件
function cleanOldDateFiles(dir) {
  if (!existsSync(dir)) return
  const cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000
  try {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      try {
        if (statSync(p).mtimeMs < cutoff) unlinkSync(p)
      } catch {
        // 忽略单文件清理失败
      }
    }
  } catch {
    // 忽略整目录读取失败
  }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// 打开文件写入流，惰性创建
const openStreams = new Map()

function getStream(filePath) {
  if (!openStreams.has(filePath)) {
    checkRotate(filePath)
    const ws = createWriteStream(filePath, { flags: 'a', encoding: 'utf8' })
    openStreams.set(filePath, ws)
  }
  return openStreams.get(filePath)
}

// 写入一行到文件（自带换行）；filePath 若超大则 rotate + 重新打开
function writeLine(filePath, line) {
  checkRotate(filePath)
  // rotate 后 stream 旧引用已失效，若文件不存在（被 rotate 移走）需刷新
  if (openStreams.has(filePath) && !existsSync(filePath)) {
    const old = openStreams.get(filePath)
    old.end()
    openStreams.delete(filePath)
  }
  const ws = getStream(filePath)
  ws.write(line + '\n')
}

// 解析 pino numeric level 到字符串
function pinoLevelStr(numeric) {
  if (numeric >= 60) return 'fatal'
  if (numeric >= 50) return 'error'
  if (numeric >= 40) return 'warn'
  if (numeric >= 30) return 'info'
  if (numeric >= 20) return 'debug'
  return 'trace'
}

// 判断 JSON 行的 level 是否为 error/fatal（用于 errors 聚合）
function isErrorLevel(parsed) {
  const lv = parsed.level
  if (typeof lv === 'number') return lv >= 50
  if (typeof lv === 'string') return lv === 'error' || lv === 'fatal'
  return false
}

// 判断 JSON 行的 level 是否为 warn 及以上（>= 40）
function isWarnOrAbove(parsed) {
  const lv = parsed.level
  if (typeof lv === 'number') return lv >= 40
  if (typeof lv === 'string') return lv === 'warn' || lv === 'error' || lv === 'fatal'
  return false
}

// 处理单行输出：控制台打印、落盘 .log + .ndjson、errors/client 分流
function handleLine(label, stream, rawLine) {
  const color = SERVICE_COLORS[label] ?? '\x1b[37m'
  // 主终端打印（彩色前缀）
  process.stdout.write(`${color}[${label}]${RESET} ${rawLine}\n`)

  const logPath = join(DEV_DIR, `${label}.log`)
  const ndjsonPath = join(DEV_DIR, `${label}.ndjson`)
  const errorsPath = join(ERRORS_DIR, `errors-${todayStr()}.ndjson`)
  const clientPath = join(CLIENT_DIR, `client-${todayStr()}.ndjson`)

  // 写 .log（人读，原始内容）
  writeLine(logPath, rawLine)

  // 尝试解析 JSON
  let parsed = null
  try {
    parsed = JSON.parse(rawLine)
  } catch {
    // 非 JSON
  }

  if (parsed !== null && typeof parsed === 'object') {
    // JSON 行：补 ts/level/service/stream，原字段经 ...parsed 优先；level 单独后置归一为字符串
    const tsFromTime =
      typeof parsed.time === 'number' ? new Date(parsed.time).toISOString() : null
    const enriched = {
      ts: parsed.ts ?? tsFromTime ?? new Date().toISOString(),
      service: parsed.service ?? label,
      stream: parsed.stream ?? stream,
      ...parsed,
      level:
        typeof parsed.level === 'number'
          ? pinoLevelStr(parsed.level)
          : (parsed.level ?? 'info'),
    }
    const enrichedLine = JSON.stringify(enriched)
    writeLine(ndjsonPath, enrichedLine)

    // client 流前向兼容：见到 service:'client' 分流到 logs/client/
    if (enriched.service === 'client') {
      writeLine(clientPath, enrichedLine)
    }

    // errors 聚合：level >= warn 写 errors（决策 4 选 B）
    if (isWarnOrAbove(enriched)) {
      writeLine(errorsPath, enrichedLine)
    }
  } else {
    // 非 JSON 行：wrap 成最小 ndjson 结构后写
    const wrapped = JSON.stringify({
      ts: new Date().toISOString(),
      service: label,
      stream,
      msg: rawLine,
    })
    writeLine(ndjsonPath, wrapped)

    // 非 JSON 行 errors 聚合：仅 stderr + 保守前缀
    if (stream === 'stderr' && ERROR_PREFIXES.some(p => rawLine.startsWith(p))) {
      writeLine(errorsPath, wrapped)
    }
  }
}

// 关闭所有写入流（SIGINT flush）
function closeAllStreams() {
  const promises = []
  for (const [, ws] of openStreams) {
    promises.push(new Promise(resolve => ws.end(resolve)))
  }
  openStreams.clear()
  return Promise.all(promises)
}

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

function startTask({ label, cwd, command, args, persistent }) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  children.set(child.pid, { child, label })

  // stdout 行缓冲
  const rlOut = createInterface({ input: child.stdout, crlfDelay: Infinity })
  rlOut.on('line', line => handleLine(label, 'stdout', line))

  // stderr 行缓冲
  const rlErr = createInterface({ input: child.stderr, crlfDelay: Infinity })
  rlErr.on('line', line => handleLine(label, 'stderr', line))

  child.on('exit', (code, signal) => {
    children.delete(child.pid)
    if (shuttingDown) return
    if (!persistent && code === 0) return
    if (signal === 'SIGINT' || signal === 'SIGTERM') {
      shutdown(0)
      return
    }

    const reason = signal ? `signal ${signal}` : `exit code ${code ?? 0}`
    devLog(`${label} stopped unexpectedly (${reason}); shutting down remaining dev services`)
    shutdown(code && code > 0 ? code : 1)
  })

  child.on('error', (error) => {
    children.delete(child.pid)
    if (shuttingDown) return

    devLog(`${label} failed to start: ${error.message}`)
    shutdown(1)
  })
}

function killChild({ child, label }, signal) {
  if (child.killed) return

  try {
    child.kill(signal)
  } catch (error) {
    if (error.code !== 'ESRCH') {
      devLog(`failed to send ${signal} to ${label}: ${error.message}`)
    }
  }
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true

  devLog('stopping dev services')

  let exited = false
  const finalExit = async () => {
    if (exited) return
    exited = true
    // 等所有 child 'close' 后再 close streams，避免子进程退出前的尾行被丢弃
    await closeAllStreams()
    process.exit(exitCode)
  }

  if (children.size === 0) {
    await finalExit()
    return
  }

  // 子进程 'close' 比 'exit' 晚，stdio 流也已确认关闭；全 close 后才 flush
  let pending = children.size
  for (const entry of children.values()) {
    entry.child.once('close', () => {
      pending--
      if (pending === 0) finalExit()
    })
    killChild(entry, 'SIGTERM')
  }

  // 3s SIGKILL 兜底
  setTimeout(() => {
    for (const entry of children.values()) killChild(entry, 'SIGKILL')
  }, 3000).unref()

  // 5s finalExit 兜底（即便 close 事件未来）
  setTimeout(() => finalExit(), 5000).unref()
}

process.once('SIGINT', () => shutdown(0))
process.once('SIGTERM', () => shutdown(0))
process.once('SIGHUP', () => shutdown(0))

// 启动初始化
ensureDirs()
cleanOldDateFiles(ERRORS_DIR)
cleanOldDateFiles(CLIENT_DIR)
devLog(`logs directory: ${LOG_DIR}`)
devLog(`  dev logs:    ${DEV_DIR}`)
devLog(`  errors logs: ${ERRORS_DIR}`)
devLog(`  client logs: ${CLIENT_DIR}`)

for (const task of tasks) {
  startTask(task)
}
