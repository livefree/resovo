/**
 * metrics.ts — Fastify 请求指标收集插件
 * CHG-32: 内存滑动窗口，不写 Redis/DB
 *
 * 约束：hook 逻辑极轻量，不使用 await，不阻塞请求路径
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

// ── 类型定义 ──────────────────────────────────────────────────────

export interface RequestEntry {
  timestamp: number   // Unix ms
  durationMs: number
  method: string
  url: string
  statusCode: number
}

export interface MetricsAccessor {
  readonly requestsPerMinute: number
  readonly total24h: number
  readonly avgResponseMs: number
  readonly p95ResponseMs: number
  readonly slowRequests: RequestEntry[]  // >500ms，最近 10 条
}

declare module 'fastify' {
  interface FastifyInstance {
    metrics: MetricsAccessor
  }
  interface FastifyRequest {
    _startTime?: number
  }
}

// ── 内存滑动窗口 ──────────────────────────────────────────────────

const MAX_ENTRIES = 50_000                  // 最多保留 5 万条，防止 OOM
const WINDOW_24H_MS = 24 * 60 * 60 * 1000  // 24 小时
const WINDOW_5MIN_MS = 5 * 60 * 1000       // 5 分钟（用于 avg/p95）
const WINDOW_1MIN_MS = 60 * 1000           // 1 分钟（用于 perMinute）
const SLOW_THRESHOLD_MS = 500

// 使用 ring buffer 思路：只 append，定期从头部 prune
const entries: RequestEntry[] = []

function pruneOldEntries() {
  const cutoff = Date.now() - WINDOW_24H_MS
  // 二分查找比线性 shift 更高效
  let lo = 0
  let hi = entries.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (entries[mid].timestamp < cutoff) lo = mid + 1
    else hi = mid
  }
  if (lo > 0) entries.splice(0, lo)
}

function addEntry(entry: RequestEntry) {
  entries.push(entry)
  if (entries.length > MAX_ENTRIES) {
    entries.shift()
  }
  // Prune every ~100 entries to avoid O(n) on every request
  if (entries.length % 100 === 0) {
    pruneOldEntries()
  }
}

// ── MetricsAccessor 实现 ──────────────────────────────────────────

const metricsAccessor: MetricsAccessor = {
  get requestsPerMinute(): number {
    const cutoff = Date.now() - WINDOW_1MIN_MS
    let count = 0
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].timestamp < cutoff) break
      count++
    }
    return count
  },

  get total24h(): number {
    pruneOldEntries()
    return entries.length
  },

  get avgResponseMs(): number {
    const cutoff = Date.now() - WINDOW_5MIN_MS
    let sum = 0
    let count = 0
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].timestamp < cutoff) break
      sum += entries[i].durationMs
      count++
    }
    if (count === 0) return 0
    return Math.round(sum / count)
  },

  get p95ResponseMs(): number {
    const cutoff = Date.now() - WINDOW_5MIN_MS
    const durations: number[] = []
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].timestamp < cutoff) break
      durations.push(entries[i].durationMs)
    }
    if (durations.length === 0) return 0
    durations.sort((a, b) => a - b)
    const idx = Math.ceil(durations.length * 0.95) - 1
    return durations[Math.max(0, idx)]
  },

  get slowRequests(): RequestEntry[] {
    const slow = entries.filter((e) => e.durationMs > SLOW_THRESHOLD_MS)
    return slow.slice(-10)
  },
}

// ── 插件注册 ──────────────────────────────────────────────────────

export function setupMetrics(fastify: FastifyInstance): void {
  // 暴露 metrics 装饰器
  fastify.decorate('metrics', metricsAccessor)

  // 记录请求开始时间（不 await）
  fastify.addHook('onRequest', (request: FastifyRequest, _reply: FastifyReply, done) => {
    request._startTime = Date.now()
    done()
  })

  // 计算响应时间并写入滑动窗口（不 await）
  fastify.addHook('onResponse', (request: FastifyRequest, reply: FastifyReply, done) => {
    const start = request._startTime
    if (start !== undefined) {
      addEntry({
        timestamp: Date.now(),
        durationMs: Date.now() - start,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
      })
    }
    done()
  })
}

/** 测试辅助：清空内存窗口 */
export function clearMetricsStore(): void {
  entries.splice(0)
}

/** 测试辅助：直接插入条目 */
export function injectMetricsEntry(entry: RequestEntry): void {
  entries.push(entry)
}
