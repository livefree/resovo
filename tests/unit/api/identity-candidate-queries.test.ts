/**
 * identity-candidate-queries.test.ts — identity_candidate DB query SQL/参数（CHG-VIR-8）
 * mock Pool/Client，断言关键 SQL 片段 + 参数（仿 titleObservations.test.ts 范式）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  findPendingByPairKey,
  findLatestRejectedByPairKey,
  insertCandidate,
  supersedePendingByPairKey,
  setSupersededBy,
  countCompareBuckets,
  type IdentityCandidateInsert,
} from '@/api/db/queries/identity-candidate'

const mockQuery = vi.fn()
const mockClient = { query: mockQuery } as unknown as import('pg').PoolClient
const mockDb = { query: mockQuery } as unknown as import('pg').Pool

beforeEach(() => {
  mockQuery.mockReset()
  mockQuery.mockResolvedValue({ rows: [] })
})

function lastSql(): string {
  return String(mockQuery.mock.calls[mockQuery.mock.calls.length - 1]![0])
}
function lastParams(): unknown[] {
  return mockQuery.mock.calls[mockQuery.mock.calls.length - 1]![1] as unknown[]
}

describe('findPendingByPairKey', () => {
  it("WHERE status='pending' + 参数", async () => {
    await findPendingByPairKey(mockClient, 'a|b')
    expect(lastSql()).toContain("status = 'pending'")
    expect(lastParams()).toEqual(['a|b'])
  })
})

describe('findLatestRejectedByPairKey', () => {
  it("WHERE status='rejected' + ORDER BY created_at DESC", async () => {
    await findLatestRejectedByPairKey(mockClient, 'a|b')
    const sql = lastSql()
    expect(sql).toContain("status = 'rejected'")
    expect(sql).toContain('ORDER BY created_at DESC')
  })
})

describe('insertCandidate', () => {
  const ins: IdentityCandidateInsert = {
    leftVideoId: 'a', rightVideoId: 'b', canonicalPairKey: 'a|b',
    parserVersion: '1.0.0', scorerVersion: '1.0.0', evidenceJsonb: [{ x: 1 }], evidenceHash: 'h',
    legacyScore: null, identityScore: 0.8, strongNegativeReasons: ['season_mismatch'],
    triggerSource: 'offline-rescore', groupKey: null, revivedFromCandidateId: null,
  }

  it('ON CONFLICT partial unique DO NOTHING RETURNING（并发兜底）', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'new' }] })
    const r = await insertCandidate(mockClient, ins)
    const sql = lastSql()
    expect(sql).toContain('ON CONFLICT (canonical_pair_key) WHERE status = ')
    expect(sql).toContain('DO NOTHING')
    expect(sql).toContain('RETURNING')
    expect(r).toEqual({ id: 'new' })
  })

  it('evidence_jsonb 经 JSON.stringify 传参', async () => {
    await insertCandidate(mockClient, ins)
    const params = lastParams()
    expect(params[5]).toBe(JSON.stringify([{ x: 1 }]))
  })

  it('ON CONFLICT 跳过（rows 空）→ 返回 null', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const r = await insertCandidate(mockClient, ins)
    expect(r).toBeNull()
  })
})

describe('supersedePendingByPairKey', () => {
  it("SET status='superseded' WHERE pending + RETURNING id", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'old' }] })
    const r = await supersedePendingByPairKey(mockClient, 'a|b')
    const sql = lastSql()
    expect(sql).toContain("status = 'superseded'")
    expect(sql).toContain("status = 'pending'")
    expect(sql).toContain('RETURNING id')
    expect(r).toBe('old')
  })
})

describe('setSupersededBy', () => {
  it('回填 superseded_by_candidate_id', async () => {
    await setSupersededBy(mockClient, 'old', 'new')
    expect(lastSql()).toContain('superseded_by_candidate_id = $2')
    expect(lastParams()).toEqual(['old', 'new'])
  })
})

describe('countCompareBuckets', () => {
  it('FILTER 三桶（拦截 / 跨 group）+ 版本过滤', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ pending_total: '10', blocked_total: '3', cross_group_total: '4' }] })
    const r = await countCompareBuckets(mockDb, { scorerVersion: '1.0.0', parserVersion: '1.0.0' })
    const sql = lastSql()
    expect(sql).toContain('cardinality(ic.strong_negative_reasons) > 0')
    expect(sql).toContain('title_normalized')
    expect(r).toEqual({ pendingTotal: 10, blockedTotal: 3, crossGroupTotal: 4 })
  })
})
