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
  countCompareBucketsBySource,
  listForCompareReport,
  listPendingCandidatesByVideoId,
  listPendingCandidatePairs,
  countPendingCandidatePairs,
  // ADR-105a AMENDMENT 2026-06-05 D-105a-19（CHG-VIR-16-TBL-BE）：轻列折叠管线
  listPendingCandidatePairsLight,
  listPendingPairsLightByVideoIds,
  listPendingPairsByIds,
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

// ── CHG-VIR-10：trigger_source 切片报表 ──

describe('countCompareBucketsBySource', () => {
  it('GROUP BY trigger_source 三桶切片 + 版本过滤', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [
      { trigger_source: 'ingest', pending_total: '2', blocked_total: '1', cross_group_total: '1' },
      { trigger_source: 'offline-rescore', pending_total: '8', blocked_total: '2', cross_group_total: '3' },
    ] })
    const r = await countCompareBucketsBySource(mockDb, { scorerVersion: '1.0.0', parserVersion: '1.0.0' })
    const sql = lastSql()
    expect(sql).toContain('GROUP BY ic.trigger_source')
    expect(sql).toContain('cardinality(ic.strong_negative_reasons) > 0')
    expect(lastParams()).toEqual(['1.0.0', '1.0.0'])
    expect(r).toEqual([
      { triggerSource: 'ingest', pendingTotal: 2, blockedTotal: 1, crossGroupTotal: 1 },
      { triggerSource: 'offline-rescore', pendingTotal: 8, blockedTotal: 2, crossGroupTotal: 3 },
    ])
  })
})

describe('listForCompareReport — triggerSource 可选切片（CHG-VIR-10）', () => {
  it('缺省不过滤（$5 传 null）', async () => {
    await listForCompareReport(mockDb, { scorerVersion: '1.0.0', parserVersion: '1.0.0', limit: 30, offset: 0 })
    expect(lastSql()).toContain('$5::text IS NULL OR ic.trigger_source = $5')
    expect(lastParams()).toEqual(['1.0.0', '1.0.0', 30, 0, null])
  })

  it('指定 triggerSource=ingest → $5 参数透传', async () => {
    await listForCompareReport(mockDb, {
      scorerVersion: '1.0.0', parserVersion: '1.0.0', limit: 30, offset: 0, triggerSource: 'ingest',
    })
    expect(lastParams()).toEqual(['1.0.0', '1.0.0', 30, 0, 'ingest'])
  })
})

describe('listPendingCandidatesByVideoId（CHG-VIR-9-A 审核台召回）', () => {
  it('CASE 取对侧 video + status=pending + 版本过滤 + 参数', async () => {
    await listPendingCandidatesByVideoId(mockDb, { videoId: 'v1', scorerVersion: '1.0.0', parserVersion: '1.0.0', limit: 10 })
    const sql = lastSql()
    expect(sql).toContain('CASE WHEN ic.left_video_id = $1 THEN ic.right_video_id ELSE ic.left_video_id END')
    expect(sql).toContain("status = 'pending'")
    expect(sql).toContain('ic.scorer_version = $2')
    expect(lastParams()).toEqual(['v1', '1.0.0', '1.0.0', 10])
  })
})

describe('listPendingCandidatePairs（CHG-VIR-9-A merge 折叠 / 9-C FIX-3 软删排除）', () => {
  it('status=pending + 版本过滤 + ORDER BY identity_score', async () => {
    await listPendingCandidatePairs(mockDb, { scorerVersion: '1.0.0', parserVersion: '1.0.0', limit: 20, offset: 0 })
    const sql = lastSql()
    expect(sql).toContain("status = 'pending'")
    expect(sql).toContain('ORDER BY identity_score DESC')
    expect(lastParams()).toEqual(['1.0.0', '1.0.0', 20, 0])
  })

  it('FIX-3（Codex review）：双侧 EXISTS 排除软删视频（stale 候选确认必败）', async () => {
    await listPendingCandidatePairs(mockDb, { scorerVersion: '1.0.0', parserVersion: '1.0.0', limit: 20, offset: 0 })
    const sql = lastSql()
    expect(sql).toContain('lv.id = ic.left_video_id AND lv.deleted_at IS NULL')
    expect(sql).toContain('rv.id = ic.right_video_id AND rv.deleted_at IS NULL')
  })
})

describe('countPendingCandidatePairs（CHG-VIR-9-C FIX-2 分页 total / D-105a-19 列表路径退役，本体保留供报表与测试）', () => {
  it('COUNT(*) + 与 list 同 WHERE 口径（pending + 版本过滤 + 软删双侧排除）', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '35' }] })
    const n = await countPendingCandidatePairs(mockDb, { scorerVersion: '1.0.0', parserVersion: '1.0.0' })
    expect(n).toBe(35)
    const sql = lastSql()
    expect(sql).toContain('COUNT(*)')
    expect(sql).toContain("status = 'pending'")
    expect(sql).toContain('lv.deleted_at IS NULL')
    expect(sql).toContain('rv.deleted_at IS NULL')
    expect(lastParams()).toEqual(['1.0.0', '1.0.0'])
  })

  it('rows 空容错返回 0', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const n = await countPendingCandidatePairs(mockDb, { scorerVersion: '1.0.0', parserVersion: '1.0.0' })
    expect(n).toBe(0)
  })
})

// ── ADR-105a AMENDMENT 2026-06-05 D-105a-19（CHG-VIR-16-TBL-BE）：轻列折叠管线 ──

describe('listPendingCandidatePairsLight（D-105a-19 stage 1 轻列全量）', () => {
  it('轻列 SELECT（无 evidence_jsonb 等重列）+ 同 WHERE 口径 + LIMIT 探测', async () => {
    await listPendingCandidatePairsLight(mockDb, { scorerVersion: '1.0.0', parserVersion: '1.0.0', limit: 2001 })
    const sql = lastSql()
    expect(sql).toContain('canonical_pair_key')
    expect(sql).not.toContain('evidence_jsonb')
    expect(sql).not.toContain('strong_negative_reasons')
    expect(sql).not.toContain('legacy_score')
    expect(sql).toContain("status = 'pending'")
    expect(sql).toContain('lv.deleted_at IS NULL')
    expect(sql).toContain('ORDER BY identity_score DESC')
    expect(sql).toContain('LIMIT $3')
    expect(lastParams()).toEqual(['1.0.0', '1.0.0', 2001])
  })
})

describe('listPendingPairsLightByVideoIds（D-105a-19 截断态闭包补全 / 评审 R-1 方案 b）', () => {
  it('video 集合双侧 ANY + 同 WHERE 口径；空集合短路零查询', async () => {
    await listPendingPairsLightByVideoIds(mockDb, { scorerVersion: '1.0.0', parserVersion: '1.0.0', videoIds: ['a', 'b'] })
    const sql = lastSql()
    expect(sql).toContain('ic.left_video_id = ANY($3) OR ic.right_video_id = ANY($3)')
    expect(sql).toContain("status = 'pending'")
    expect(sql).not.toContain('evidence_jsonb')
    expect(lastParams()).toEqual(['1.0.0', '1.0.0', ['a', 'b']])

    mockQuery.mockClear()
    const r = await listPendingPairsLightByVideoIds(mockDb, { scorerVersion: '1.0.0', parserVersion: '1.0.0', videoIds: [] })
    expect(r).toEqual([])
    expect(mockQuery).not.toHaveBeenCalled()
  })
})

describe('listPendingPairsByIds（D-105a-19 stage 5 完整行回查）', () => {
  it('id ANY + pending 守卫（并发裁定脱落）+ 完整列；空 ids 短路零查询', async () => {
    await listPendingPairsByIds(mockDb, ['c1', 'c2'])
    const sql = lastSql()
    expect(sql).toContain('ic.id = ANY($1)')
    expect(sql).toContain("ic.status = 'pending'")
    expect(sql).toContain('evidence_jsonb')
    expect(sql).toContain('ORDER BY identity_score DESC')
    expect(lastParams()).toEqual([['c1', 'c2']])

    mockQuery.mockClear()
    const r = await listPendingPairsByIds(mockDb, [])
    expect(r).toEqual([])
    expect(mockQuery).not.toHaveBeenCalled()
  })
})
