/**
 * moderation-pending-queue-filters.test.ts — MODUX-P3-1-B
 *
 * 验证 listPendingQueue 按 year/decade/enrichmentStatus 构建 WHERE（mock Pool 捕获 SQL/params，
 * 无真库）：年份精确 / 年代区间 / 富集派生片段 / count 查询补 media_catalog JOIN。
 */
import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import { listPendingQueue } from '@/api/db/queries/moderation'

interface Call { sql: string; params: unknown[] }

function makeMockDb(calls: Call[]): Pool {
  return {
    query: vi.fn((sql: string, params: unknown[]) => {
      calls.push({ sql, params })
      if (/admin_audit_log/.test(sql)) return Promise.resolve({ rows: [{ reviewed: '0', approved: '0' }] })
      if (/COUNT\(\*\) FROM videos/.test(sql)) return Promise.resolve({ rows: [{ count: '0' }] })
      return Promise.resolve({ rows: [] }) // main SELECT
    }),
  } as unknown as Pool
}

const mainOf = (calls: Call[]) => calls.find((c) => /SELECT v\.id/.test(c.sql))!
const countOf = (calls: Call[]) => calls.find((c) => /COUNT\(\*\) FROM videos/.test(c.sql))!

describe('listPendingQueue — year/decade/enrichmentStatus 过滤（MODUX-P3-1-B）', () => {
  it('year=2024 → WHERE mc.year = $ + 参数含 2024', async () => {
    const calls: Call[] = []
    await listPendingQueue(makeMockDb(calls), { year: 2024 }, 'actor')
    const main = mainOf(calls)
    expect(main.sql).toContain('mc.year = $')
    expect(main.params).toContain(2024)
  })

  it('decade=2020 → WHERE mc.year >= $ AND mc.year < $ + 参数含 2020 与 2030', async () => {
    const calls: Call[] = []
    await listPendingQueue(makeMockDb(calls), { decade: 2020 }, 'actor')
    const main = mainOf(calls)
    expect(main.sql).toContain('mc.year >= $')
    expect(main.sql).toContain('mc.year < $')
    expect(main.params).toContain(2020)
    expect(main.params).toContain(2030)
  })

  it("enrichmentStatus=complete → 派生片段（enriched_at NOT NULL + douban matched/bangumi）", async () => {
    const calls: Call[] = []
    await listPendingQueue(makeMockDb(calls), { enrichmentStatus: 'complete' }, 'actor')
    const sql = mainOf(calls).sql
    expect(sql).toContain("meta_quality->>'enriched_at') IS NOT NULL")
    expect(sql).toContain("v.douban_status = 'matched'")
    expect(sql).toContain('mc.bangumi_subject_id IS NOT NULL')
  })

  it("enrichmentStatus=missing → 派生片段（enriched_at NULL + 外部 ID 全 NULL）", async () => {
    const calls: Call[] = []
    await listPendingQueue(makeMockDb(calls), { enrichmentStatus: 'missing' }, 'actor')
    const sql = mainOf(calls).sql
    expect(sql).toContain("meta_quality->>'enriched_at') IS NULL")
    expect(sql).toContain('mc.douban_id IS NULL')
    expect(sql).toContain('mc.imdb_id IS NULL')
  })

  it('enrichmentStatus=partial → NOT complete AND NOT missing（无新参数）', async () => {
    const calls: Call[] = []
    await listPendingQueue(makeMockDb(calls), { enrichmentStatus: 'partial' }, 'actor')
    const sql = mainOf(calls).sql
    expect(sql).toMatch(/NOT \(\(.*enriched_at.*\) AND NOT \(\(.*enriched_at.*\)/s)
  })

  it('count 查询补 media_catalog JOIN（支持 mc.* 过滤，保数不变）', async () => {
    const calls: Call[] = []
    await listPendingQueue(makeMockDb(calls), { year: 2024 }, 'actor')
    expect(countOf(calls).sql).toContain('JOIN media_catalog mc ON mc.id = v.catalog_id')
  })

  it('无年代/富集过滤 → main SQL 不含 mc.year 过滤（加性、不影响既有）', async () => {
    const calls: Call[] = []
    await listPendingQueue(makeMockDb(calls), {}, 'actor')
    expect(mainOf(calls).sql).not.toContain('mc.year = $')
  })
})
