/**
 * tests/unit/api/externalFetchRecorder.test.ts
 * CHG-EXT-RES-STORE-B（ADR-188 D-188-4）：采集埋点旁路 recordFetch + 错误分类/摘要。
 *   - recordFetch 写入 + 写入异常吞掉（旁路不阻塞业务）
 *   - classifyFetchError：AbortError/TimeoutError(含 DOMException) → timeout，其余 → fail
 *   - fetchErrorSummary 截断
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// recordFetch 惰性 import postgres 取 db → mock 成桩 Pool（无需真实 DATABASE_URL）
vi.mock('@/api/lib/postgres', () => ({ db: { __mock: 'pool' } }))

// vi.hoisted：工厂提升到 import 之前，外层 const 引用须经 hoisted
const { insertFetchLog } = vi.hoisted(() => ({ insertFetchLog: vi.fn() }))
vi.mock('@/api/db/queries/external-fetch-log', async (orig) => ({
  ...(await orig<typeof import('@/api/db/queries/external-fetch-log')>()),
  insertFetchLog,
}))

import { recordFetch, classifyFetchError, fetchErrorSummary } from '@/api/lib/external-fetch-recorder'

beforeEach(() => vi.clearAllMocks())

describe('recordFetch', () => {
  it('调 insertFetchLog 透传 input', async () => {
    insertFetchLog.mockResolvedValue(undefined)
    await recordFetch({ provider: 'douban', operation: 'search', method: 'scrape', status: 'ok', itemCount: 3 })
    expect(insertFetchLog).toHaveBeenCalledOnce()
    expect(insertFetchLog.mock.calls[0][1]).toMatchObject({
      provider: 'douban',
      operation: 'search',
      status: 'ok',
      itemCount: 3,
    })
  })

  it('insertFetchLog 抛错 → 吞掉不抛（观测旁路绝不阻塞业务）', async () => {
    insertFetchLog.mockRejectedValue(new Error('db down'))
    await expect(
      recordFetch({ provider: 'douban', operation: 'detail', method: 'scrape', status: 'ok' }),
    ).resolves.toBeUndefined()
  })
})

describe('classifyFetchError', () => {
  it('DOMException TimeoutError（AbortSignal.timeout 抛）→ timeout', () => {
    expect(classifyFetchError(new DOMException('timed out', 'TimeoutError'))).toBe('timeout')
  })

  it('AbortError → timeout', () => {
    const e = new Error('aborted')
    e.name = 'AbortError'
    expect(classifyFetchError(e)).toBe('timeout')
  })

  it('普通 Error / 非 Error → fail', () => {
    expect(classifyFetchError(new Error('boom'))).toBe('fail')
    expect(classifyFetchError('str')).toBe('fail')
    expect(classifyFetchError(null)).toBe('fail')
  })
})

describe('fetchErrorSummary', () => {
  it('取 Error.message；超长截断 500', () => {
    expect(fetchErrorSummary(new Error('abc'))).toBe('abc')
    expect(fetchErrorSummary(new Error('x'.repeat(600)))).toHaveLength(500)
    expect(fetchErrorSummary('plain')).toBe('plain')
  })
})
