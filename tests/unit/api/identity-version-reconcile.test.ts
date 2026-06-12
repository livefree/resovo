/**
 * identity-version-reconcile.test.ts — GOV-3（SEQ-20260612-03）版本对账编排
 *
 * 验收红线：
 *  1. 失配检测双信号独立（观测缺口 / 旧版本 pending）。
 *  2. 编排条件分支：无失配 → 仅重扫；观测缺口 → 先重写再重扫；stale → 重扫后 supersede。
 *  3. 重扫恒执行（周期兜底语义，GOV-5 合并裁决）。
 *  4. 观测重写走查询层 insertObservationIfAbsent（migration 085 唯一键单真源）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { runIdentityRescoreMock, insertObservationIfAbsentMock, hasStaleMock, supersedeStaleMock } = vi.hoisted(() => ({
  runIdentityRescoreMock: vi.fn(),
  insertObservationIfAbsentMock: vi.fn(),
  hasStaleMock: vi.fn(),
  supersedeStaleMock: vi.fn(),
}))

vi.mock('@/api/services/identity/offlineRescore', () => ({
  runIdentityRescore: runIdentityRescoreMock,
}))
vi.mock('@/api/db/queries/titleObservations', () => ({
  insertObservationIfAbsent: insertObservationIfAbsentMock,
}))
vi.mock('@/api/db/queries/identity-candidate', () => ({
  hasStaleVersionPending: hasStaleMock,
  supersedeStaleVersionPending: supersedeStaleMock,
}))

import { reconcileIdentityVersions, detectVersionMismatch } from '@/api/services/identity/versionReconcile'
import pino from 'pino'

const log = pino({ enabled: false })
const mockQuery = vi.fn()
const mockDb = { query: mockQuery } as unknown as import('pg').Pool

const RESCORE_RESULT = { buckets: 1, externalIdBuckets: 0, pairs: 2, created: 1, superseded: 0, noop: 1, revived: 0, skippedRejected: 0, skippedLowScore: 0, bucketsSkippedOversize: 0, blocked: 0, durationMs: 5 }

beforeEach(() => {
  vi.clearAllMocks()
  runIdentityRescoreMock.mockResolvedValue(RESCORE_RESULT)
  supersedeStaleMock.mockResolvedValue(0)
})

describe('detectVersionMismatch — 双信号独立', () => {
  it('观测缺口 EXISTS + stale pending 各自透出', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ exists: true }] })
    hasStaleMock.mockResolvedValueOnce(false)
    const m = await detectVersionMismatch(mockDb)
    expect(m).toEqual({ observationsMissing: true, stalePending: false })
  })
})

describe('reconcileIdentityVersions — 条件编排', () => {
  it('无失配 → 跳过观测重写与 supersede，重扫恒执行（周期兜底）', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ exists: false }] }) // 观测缺口检测
    hasStaleMock.mockResolvedValueOnce(false)
    const r = await reconcileIdentityVersions(mockDb, log)
    expect(insertObservationIfAbsentMock).not.toHaveBeenCalled()
    expect(supersedeStaleMock).not.toHaveBeenCalled()
    expect(runIdentityRescoreMock).toHaveBeenCalledTimes(1)
    expect(r.observationsInserted).toBe(0)
    expect(r.rescore).toBe(RESCORE_RESULT)
  })

  it('观测缺口 → cursor 分批重写（查询层函数）后重扫；插入计数 = 实际插入', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ exists: true }] })   // 检测：缺口
      .mockResolvedValueOnce({ rows: [                        // 重写批 1：2 个 video
        { id: 'v1', title: '某剧 第2季' }, { id: 'v2', title: '某片' },
      ] })
      .mockResolvedValueOnce({ rows: [] })                    // 重写批 2：空 → 结束
    hasStaleMock.mockResolvedValueOnce(false)
    insertObservationIfAbsentMock
      .mockResolvedValueOnce(true)    // v1 实际插入
      .mockResolvedValueOnce(false)   // v2 已存在跳过
    const r = await reconcileIdentityVersions(mockDb, log)
    expect(insertObservationIfAbsentMock).toHaveBeenCalledTimes(2)
    expect(r.observationsInserted).toBe(1)
    expect(runIdentityRescoreMock).toHaveBeenCalledTimes(1)
  })

  it('stale pending → 重扫后显式 supersede 并透出计数', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ exists: false }] })
    hasStaleMock.mockResolvedValueOnce(true)
    supersedeStaleMock.mockResolvedValueOnce(3)
    const r = await reconcileIdentityVersions(mockDb, log)
    expect(supersedeStaleMock).toHaveBeenCalledTimes(1)
    expect(r.stalePendingSuperseded).toBe(3)
    // supersede 在重扫之后（candidateUpsert 自动腾位优先，残留才显式清）
    const supersedeOrder = supersedeStaleMock.mock.invocationCallOrder[0]!
    const rescoreOrder = runIdentityRescoreMock.mock.invocationCallOrder[0]!
    expect(supersedeOrder).toBeGreaterThan(rescoreOrder)
  })
})
