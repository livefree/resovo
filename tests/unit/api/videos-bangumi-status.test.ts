/**
 * videos-bangumi-status.test.ts — META-07 / ADR-170 C-1
 *
 * 覆盖：
 *   1. updateVideoBangumiStatus query SQL/params 形态（Pool + PoolClient 双形态 / R-3）
 *   2. migration 082 SQL 文本断言（CHECK 4 值 + 列 + 索引 + 幂等标记）
 *      —— mock 单测只能验 SQL/params，DB CHECK 行为靠 SQL 文本断言或真实 PG/integration 证明
 *   3. BANGUMI_STATUSES runtime export（非 type-only，P2）
 *
 * Mock 模式参考：crawler-runs-sync-status.test.ts（不 mock queries 模块，mock pg Pool/Client）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { Pool, PoolClient } from 'pg'
import { updateVideoBangumiStatus } from '@/api/db/queries/videos.status'
import { buildEnrichmentSummary, type DbVideoRow } from '@/api/db/queries/videos'
import { BANGUMI_STATUSES } from '@/types'

const mockQuery = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  mockQuery.mockResolvedValue({ rows: [], rowCount: 1 })
})

// ── 1. updateVideoBangumiStatus query 形态 ─────────────────────────

describe('updateVideoBangumiStatus — SQL/params 形态', () => {
  it('#1 Pool 形态：UPDATE videos SET bangumi_status + 软删守卫 + params 顺序', async () => {
    const pool = { query: mockQuery, connect: vi.fn() } as unknown as Pool
    await updateVideoBangumiStatus(pool, 'video-uuid-1', 'matched')

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toMatch(/UPDATE\s+videos\s+SET\s+bangumi_status\s*=\s*\$1/i)
    expect(sql).toMatch(/updated_at\s*=\s*NOW\(\)/i)
    expect(sql).toMatch(/WHERE\s+id\s*=\s*\$2\s+AND\s+deleted_at\s+IS\s+NULL/i)
    expect(params).toEqual(['matched', 'video-uuid-1'])
  })

  it('#2 PoolClient 形态：复用传入连接（R-3 事务内调用）', async () => {
    // confirmMatch / applyAutoMatchAtomic 在 BEGIN/COMMIT 事务内用 client 调用
    const client = { query: mockQuery, release: vi.fn() } as unknown as PoolClient
    await updateVideoBangumiStatus(client, 'video-uuid-2', 'candidate')

    expect(mockQuery).toHaveBeenCalledTimes(1)
    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(params).toEqual(['candidate', 'video-uuid-2'])
  })

  it('#3 接受全部 4 个 BangumiStatus 值', async () => {
    const pool = { query: mockQuery, connect: vi.fn() } as unknown as Pool
    for (const status of BANGUMI_STATUSES) {
      await updateVideoBangumiStatus(pool, 'v', status)
    }
    expect(mockQuery).toHaveBeenCalledTimes(BANGUMI_STATUSES.length)
  })
})

// ── 2. migration 082 SQL 文本断言（DB CHECK 行为非 mock 单测能证）─────

describe('migration 082 — SQL 文本契约', () => {
  const sqlPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../apps/api/src/db/migrations/082_videos_bangumi_status.sql',
  )
  const sql = readFileSync(sqlPath, 'utf8')

  it('#4 CHECK 含全部 4 个 bangumi_status 值', () => {
    const m = sql.match(/CHECK\s*\(\s*bangumi_status\s+IN\s*\(([^)]*)\)/i)
    expect(m).not.toBeNull()
    const values = m![1]
    for (const v of ['pending', 'matched', 'candidate', 'unmatched']) {
      expect(values).toContain(`'${v}'`)
    }
  })

  it('#5 CHECK 4 值与 BANGUMI_STATUSES 类型常量一致', () => {
    const m = sql.match(/CHECK\s*\(\s*bangumi_status\s+IN\s*\(([^)]*)\)/i)
    const sqlValues = [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort()
    expect(sqlValues).toEqual([...BANGUMI_STATUSES].sort())
  })

  it('#6 加列 + NOT NULL DEFAULT pending + 部分索引（镜像 032）', () => {
    expect(sql).toMatch(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+bangumi_status\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'pending'/i)
    expect(sql).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_videos_bangumi_status/i)
    expect(sql).toMatch(/WHERE\s+deleted_at\s+IS\s+NULL/i)
  })

  it('#7 幂等 + 事务包裹', () => {
    expect(sql).toMatch(/BEGIN;/)
    expect(sql).toMatch(/COMMIT;/)
    expect(sql).toMatch(/IF\s+NOT\s+EXISTS/i)
    expect(sql).toMatch(/RAISE\s+EXCEPTION/i) // DO $$ 验证 $$
  })
})

// ── 3. buildEnrichmentSummary（ADR-170 C-3 派生投影）──────────────

describe('buildEnrichmentSummary — 富集摘要派生', () => {
  function row(p: Partial<DbVideoRow> = {}): DbVideoRow {
    return {
      douban_status: 'matched', bangumi_status: 'candidate',
      source_check_status: 'ok', meta_score: 80,
      meta_quality: { enriched_at: '2026-05-29T00:00:00Z', title_en_is_pinyin: true, douban_confidence: 0.92 },
      bangumi_subject_id: 51, ...p,
    } as DbVideoRow
  }

  it('#8 meta_quality 有值 → 展开 enrichedAt/titleEnIsPinyin/doubanConfidence + 平铺列', () => {
    expect(buildEnrichmentSummary(row())).toEqual({
      doubanStatus: 'matched', bangumiStatus: 'candidate', sourceCheckStatus: 'ok',
      metaScore: 80, enrichedAt: '2026-05-29T00:00:00Z', titleEnIsPinyin: true,
      doubanConfidence: 0.92, bangumiSubjectId: 51,
    })
  })

  it('#9 meta_quality=null → enrichedAt:null / titleEnIsPinyin:false / doubanConfidence:null（缺省）', () => {
    const s = buildEnrichmentSummary(row({ meta_quality: null, bangumi_subject_id: null }))
    expect(s.enrichedAt).toBeNull()
    expect(s.titleEnIsPinyin).toBe(false)
    expect(s.doubanConfidence).toBeNull()
    expect(s.bangumiSubjectId).toBeNull()
  })

  it('#10 状态列缺省回退 pending（防御 null 列）', () => {
    const s = buildEnrichmentSummary(row({
      douban_status: undefined as never, bangumi_status: undefined as never,
      source_check_status: undefined as never, meta_score: undefined as never,
    }))
    expect(s.doubanStatus).toBe('pending')
    expect(s.bangumiStatus).toBe('pending')
    expect(s.sourceCheckStatus).toBe('pending')
    expect(s.metaScore).toBe(0)
  })
})
