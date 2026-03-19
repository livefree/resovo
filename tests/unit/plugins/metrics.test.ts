/**
 * tests/unit/plugins/metrics.test.ts
 * CHG-32: 验证 requestsPerMinute 计数逻辑、avg/p95、慢请求
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  clearMetricsStore,
  injectMetricsEntry,
  type RequestEntry,
} from '@/api/plugins/metrics'

// Import the accessor via the module (uses the same singleton entries array)
import Fastify from 'fastify'
import { setupMetrics } from '@/api/plugins/metrics'

function makeEntry(overrides: Partial<RequestEntry> = {}): RequestEntry {
  return {
    timestamp: Date.now(),
    durationMs: 100,
    method: 'GET',
    url: '/v1/videos',
    statusCode: 200,
    ...overrides,
  }
}

describe('metrics plugin — requestsPerMinute', () => {
  let fastify: ReturnType<typeof Fastify>

  beforeEach(async () => {
    clearMetricsStore()
    fastify = Fastify({ logger: false })
    setupMetrics(fastify)
    await fastify.ready()
  })

  it('初始状态 requestsPerMinute = 0', () => {
    expect(fastify.metrics.requestsPerMinute).toBe(0)
  })

  it('注入 3 条 1 分钟内的请求后 requestsPerMinute = 3', () => {
    injectMetricsEntry(makeEntry())
    injectMetricsEntry(makeEntry())
    injectMetricsEntry(makeEntry())
    expect(fastify.metrics.requestsPerMinute).toBe(3)
  })

  it('超过 1 分钟的请求不计入 requestsPerMinute', () => {
    const twoMinAgo = Date.now() - 2 * 60 * 1000
    injectMetricsEntry(makeEntry({ timestamp: twoMinAgo }))
    injectMetricsEntry(makeEntry()) // within 1 min
    expect(fastify.metrics.requestsPerMinute).toBe(1)
  })
})

describe('metrics plugin — avgResponseMs / p95ResponseMs', () => {
  let fastify: ReturnType<typeof Fastify>

  beforeEach(async () => {
    clearMetricsStore()
    fastify = Fastify({ logger: false })
    setupMetrics(fastify)
    await fastify.ready()
  })

  it('无数据时 avgResponseMs = 0', () => {
    expect(fastify.metrics.avgResponseMs).toBe(0)
  })

  it('3 条请求正确计算均值', () => {
    injectMetricsEntry(makeEntry({ durationMs: 100 }))
    injectMetricsEntry(makeEntry({ durationMs: 200 }))
    injectMetricsEntry(makeEntry({ durationMs: 300 }))
    expect(fastify.metrics.avgResponseMs).toBe(200)
  })

  it('p95 取近似第 95 百分位', () => {
    // 10 条请求：1~10 * 100ms
    for (let i = 1; i <= 10; i++) {
      injectMetricsEntry(makeEntry({ durationMs: i * 100 }))
    }
    // p95 = ceil(10 * 0.95) - 1 = 9 (0-indexed) → 10th entry (sorted) = 1000ms
    expect(fastify.metrics.p95ResponseMs).toBe(1000)
  })

  it('超过 5 分钟的数据不计入延迟统计', () => {
    const sixMinAgo = Date.now() - 6 * 60 * 1000
    injectMetricsEntry(makeEntry({ timestamp: sixMinAgo, durationMs: 9999 }))
    injectMetricsEntry(makeEntry({ durationMs: 50 }))
    expect(fastify.metrics.avgResponseMs).toBe(50)
  })
})

describe('metrics plugin — slowRequests', () => {
  let fastify: ReturnType<typeof Fastify>

  beforeEach(async () => {
    clearMetricsStore()
    fastify = Fastify({ logger: false })
    setupMetrics(fastify)
    await fastify.ready()
  })

  it('无慢请求时返回空数组', () => {
    injectMetricsEntry(makeEntry({ durationMs: 100 }))
    expect(fastify.metrics.slowRequests).toHaveLength(0)
  })

  it('超过 500ms 的请求加入慢请求列表', () => {
    injectMetricsEntry(makeEntry({ durationMs: 600, url: '/slow' }))
    injectMetricsEntry(makeEntry({ durationMs: 100 }))
    const slow = fastify.metrics.slowRequests
    expect(slow).toHaveLength(1)
    expect(slow[0].url).toBe('/slow')
  })

  it('最多返回最近 10 条慢请求', () => {
    for (let i = 0; i < 15; i++) {
      injectMetricsEntry(makeEntry({ durationMs: 600 }))
    }
    expect(fastify.metrics.slowRequests).toHaveLength(10)
  })
})

describe('metrics plugin — total24h', () => {
  let fastify: ReturnType<typeof Fastify>

  beforeEach(async () => {
    clearMetricsStore()
    fastify = Fastify({ logger: false })
    setupMetrics(fastify)
    await fastify.ready()
  })

  it('初始为 0', () => {
    expect(fastify.metrics.total24h).toBe(0)
  })

  it('超过 24h 的请求不计入 total24h', () => {
    const twoDaysAgo = Date.now() - 25 * 60 * 60 * 1000
    injectMetricsEntry(makeEntry({ timestamp: twoDaysAgo }))
    injectMetricsEntry(makeEntry())
    expect(fastify.metrics.total24h).toBe(1)
  })
})
