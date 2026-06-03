/**
 * identity-blocking-recall.test.ts — Blocking 召回 SQL/参数（CHG-VIR-10 / D-105a-17）
 * mock Pool，断言关键 SQL 片段 + 参数（仿 identity-candidate-queries.test.ts 范式）。
 * 重点：external_id 双源（Y-105a-4）+ keyset 分页 + HAVING>1 + 单 video 召回与分桶同数据源。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fetchCoreKeyBuckets,
  fetchExternalIdBuckets,
  recallCoreKeyCounterparts,
  recallExternalIdCounterparts,
} from '@/api/services/identity/blockingRecall'

const mockQuery = vi.fn()
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

describe('fetchCoreKeyBuckets', () => {
  it('coreTitleKey 分桶 + parser_version 过滤 + keyset cursor + HAVING>1', async () => {
    await fetchCoreKeyBuckets(mockDb, '1.0.0', 'cursor-k', 500)
    const sql = lastSql()
    expect(sql).toContain(`parsed_facets_jsonb->>'coreTitleKey'`)
    expect(sql).toContain('t.parser_version = $1')
    expect(sql).toContain('HAVING COUNT(DISTINCT t.video_id) > 1')
    expect(sql).toContain('v.deleted_at IS NULL')
    expect(lastParams()).toEqual(['1.0.0', 'cursor-k', 500])
  })

  it('行映射 bucketKey/videoIds', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ bucket_key: 'k1', video_ids: ['a', 'b'] }] })
    const r = await fetchCoreKeyBuckets(mockDb, '1.0.0', '', 500)
    expect(r).toEqual([{ bucketKey: 'k1', videoIds: ['a', 'b'] }])
  })
})

describe('fetchExternalIdBuckets', () => {
  it('双源 UNION（catalog 列 + refs manual_confirmed）+ keyset cursor + HAVING>1', async () => {
    await fetchExternalIdBuckets(mockDb, '', 500)
    const sql = lastSql()
    // 源 ①：media_catalog 外部 ID 列经 catalog_id 上卷
    expect(sql).toContain("'imdb:'")
    expect(sql).toContain("'bangumi:'")
    expect(sql).toContain('mc.id = v.catalog_id')
    // 源 ②：video_external_refs（Y-105a-4 保守口径）
    expect(sql).toContain("ver.match_status = 'manual_confirmed'")
    expect(sql).toContain('ver.is_primary = true')
    expect(sql).toContain('UNION')
    expect(sql).toContain('HAVING COUNT(DISTINCT video_id) > 1')
    expect(sql).toContain('bucket_key > $1')
    expect(lastParams()).toEqual(['', 500])
  })
})

describe('recallCoreKeyCounterparts', () => {
  it('coreTitleKey 等值 + 排除自身 + LIMIT（与分桶同口径）', async () => {
    await recallCoreKeyCounterparts(mockDb, '1.0.0', '某番', 'self-id', 50)
    const sql = lastSql()
    expect(sql).toContain(`t.parsed_facets_jsonb->>'coreTitleKey' = $2`)
    expect(sql).toContain('t.video_id <> $3::uuid')
    expect(sql).toContain('v.deleted_at IS NULL')
    expect(lastParams()).toEqual(['1.0.0', '某番', 'self-id', 50])
  })
})

describe('recallExternalIdCounterparts', () => {
  it('bucket_key ANY + 排除自身 + 与分桶同数据源（manual_confirmed）', async () => {
    await recallExternalIdCounterparts(mockDb, ['imdb:tt1', 'tmdb:5'], 'self-id', 50)
    const sql = lastSql()
    expect(sql).toContain('ext.bucket_key = ANY($1::text[])')
    expect(sql).toContain('ext.video_id <> $2::uuid')
    expect(sql).toContain("ver.match_status = 'manual_confirmed'")
    expect(lastParams()).toEqual([['imdb:tt1', 'tmdb:5'], 'self-id', 50])
  })

  it('bucketKeys 为空 → 不发查询直接返回 []', async () => {
    const r = await recallExternalIdCounterparts(mockDb, [], 'self-id', 50)
    expect(r).toEqual([])
    expect(mockQuery).not.toHaveBeenCalled()
  })
})
