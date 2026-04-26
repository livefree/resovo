'use client'

/**
 * logger.client.ts — 浏览器端结构化 logger（INFRA-10）
 *
 * 公共 API：clientLogger.info/warn/error（同步推 buffer，非阻塞）
 * 全局 hook：installGlobalHooks()（在 client 启动一次）覆盖：
 *   ① window 'error'（同步异常）
 *   ② 'unhandledrejection'（未 catch Promise）
 *   ③ console.error（仅 dev，prod 不 hook 避免影响线上 console）
 *   ④ 'pagehide' / 'beforeunload' 强制 flush
 *
 * 传输：sendBeacon 优先（page unload safe），fetch keepalive 回退，1 次重试后丢弃。
 * Buffer：max 50 条 / 2s 自动 flush；error 立即 flush；满 50 立即 flush。
 * SSR 安全：所有方法在 typeof window === 'undefined' 时 no-op。
 */

type Level = 'info' | 'warn' | 'error'

interface LogEntry {
  ts: string
  level: Level
  msg: string
  ctx?: Record<string, unknown>
}

// INFRA-16 F1：用 NEXT_PUBLIC_API_URL 拼绝对 URL，对齐现有 web-next API 调用模式
// （api-client.ts:3 / video-detail.ts:9 / report-broken-image.ts:14）；
// 浏览器(:3000) → API(:4000) 跨 origin 路径必须用绝对 URL，相对路径会打到 web-next 自身
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'
const ENDPOINT = `${BASE_URL}/internal/client-log`
const MAX_BATCH = 50
const FLUSH_INTERVAL_MS = 2000
const MAX_RETRY = 1

let buffer: LogEntry[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let hooksInstalled = false

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

function scheduleFlush(): void {
  if (flushTimer !== null) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flush()
  }, FLUSH_INTERVAL_MS)
}

async function sendBatch(entries: LogEntry[], attempt = 0): Promise<boolean> {
  if (!isBrowser() || entries.length === 0) return true
  const body = JSON.stringify({ entries })

  // ① sendBeacon — page unload 时仍可送达，浏览器优先选择
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const blob = new Blob([body], { type: 'application/json' })
      const ok = navigator.sendBeacon(ENDPOINT, blob)
      if (ok) return true
    } catch {
      // sendBeacon 抛错（极少见），降级到 fetch
    }
  }

  // ② fetch keepalive
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      // INFRA-16 F1：跨 origin（web-next:3000 → api:4000）需 'include' 才能携带 cookie；
      // 配合 server.ts 全局 cors `credentials: true`（server.ts:80）使 prod 登录态能流转
      credentials: 'include',
    })
    if (res.ok) return true
  } catch {
    // 网络层失败 → 重试或丢弃
  }

  // ③ 重试 1 次后放弃
  if (attempt < MAX_RETRY) {
    return sendBatch(entries, attempt + 1)
  }
  return false
}

async function flush(): Promise<void> {
  if (buffer.length === 0) return
  const entries = buffer
  buffer = []
  if (flushTimer !== null) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  await sendBatch(entries)
}

function pushEntry(level: Level, msg: string, ctx?: Record<string, unknown>): void {
  if (!isBrowser()) return
  buffer.push({ ts: new Date().toISOString(), level, msg, ctx })
  if (level === 'error' || buffer.length >= MAX_BATCH) {
    void flush()
  } else {
    scheduleFlush()
  }
}

export const clientLogger = {
  info(msg: string, ctx?: Record<string, unknown>): void {
    pushEntry('info', msg, ctx)
  },
  warn(msg: string, ctx?: Record<string, unknown>): void {
    pushEntry('warn', msg, ctx)
  },
  error(msg: string, ctx?: Record<string, unknown>): void {
    pushEntry('error', msg, ctx)
  },
}

function hookWindowError(): void {
  window.addEventListener('error', (e: ErrorEvent) => {
    pushEntry('error', e.message || 'window.onerror', {
      source: 'window.onerror',
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
      stack: e.error instanceof Error ? e.error.stack : undefined,
    })
  })
}

function hookUnhandledRejection(): void {
  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    const reason = e.reason
    const msg = reason instanceof Error ? reason.message : String(reason)
    pushEntry('error', msg, {
      source: 'unhandledrejection',
      stack: reason instanceof Error ? reason.stack : undefined,
    })
  })
}

function hookConsoleError(): void {
  // 本函数封装 console.error 拦截，是 logger 实现自身——例外允许 console
  /* eslint-disable no-console */
  const orig = console.error
  console.error = function patched(...args: unknown[]): void {
    const msg = args
      .map(a => (typeof a === 'string' ? a : safeStringify(a)))
      .join(' ')
    pushEntry('error', msg, { source: 'console.error' })
    orig.apply(console, args)
  }
  /* eslint-enable no-console */
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function hookPageLifecycle(): void {
  const handler = (): void => { void flush() }
  window.addEventListener('pagehide', handler)
  window.addEventListener('beforeunload', handler)
}

export function installGlobalHooks(): void {
  if (!isBrowser() || hooksInstalled) return
  hooksInstalled = true
  hookWindowError()
  hookUnhandledRejection()
  hookPageLifecycle()
  if (process.env.NODE_ENV !== 'production') {
    hookConsoleError()
  }
}
