/**
 * adminSearchQueries.test.ts — SEARCH-02-A 后端搜索 query 函数 + 共享 builder 单测
 *
 * 覆盖：buildVideoMatchQuery / ilikeStrategy / searchAdminSources / searchAdminUsers / searchTaskRuns
 */
import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import { buildVideoMatchQuery } from '@/api/services/buildVideoMatchQuery'
import { ilikeStrategy } from '@/api/db/queries/text-match-strategy'
import { searchAdminSources } from '@/api/db/queries/sources'
import { searchAdminUsers } from '@/api/db/queries/users'
import { searchTaskRuns } from '@/api/db/queries/taskRuns'

/** 捕获 SQL + params 的 fake db */
function makeDb(rows: unknown[] = []) {
  const calls: Array<{ sql: string; params: unknown[] }> = []
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params })
    return { rows }
  })
  return { db: { query } as unknown as Pool, calls }
}

describe('buildVideoMatchQuery', () => {
  it('空串返回 []（与公开 SearchService if(filters.q) 守卫一致）', () => {
    expect(buildVideoMatchQuery('')).toEqual([])
  })

  it('非空返回 multi_match（字段权重 + best_fields + fuzziness AUTO）', () => {
    const clauses = buildVideoMatchQuery('钢铁侠')
    expect(clauses).toHaveLength(1)
    const mm = (clauses[0] as { multi_match: Record<string, unknown> }).multi_match
    expect(mm.query).toBe('钢铁侠')
    expect(mm.type).toBe('best_fields')
    expect(mm.fuzziness).toBe('AUTO')
    expect(mm.fields).toContain('title^3')
    expect(mm.fields).toContain('title.pinyin')
    expect(mm.fields).toContain('aliases^2')
  })
})

describe('ilikeStrategy', () => {
  it('多列 OR 拼接 ILIKE 片段', () => {
    expect(ilikeStrategy(['username', 'email'], '$1')).toBe('(username ILIKE $1 OR email ILIKE $1)')
  })
})

describe('searchAdminSources', () => {
  it('搜 source_url/source_name/v.title + 非投稿未软删边界 + 参数 [%q%, limit]', async () => {
    const { db, calls } = makeDb([{ id: 's1', source_name: 'L1', source_url: 'http://x', video_id: 'v1', video_title: 'T', site_key: 'sk' }])
    const rows = await searchAdminSources(db, 'abc', 8)
    expect(rows).toHaveLength(1)
    const { sql, params } = calls[0]!
    expect(sql).toContain('s.deleted_at IS NULL')
    expect(sql).toContain('s.submitted_by IS NULL')
    expect(sql).toContain('s.source_url ILIKE $1 OR s.source_name ILIKE $1 OR v.title ILIKE $1')
    expect(params).toEqual(['%abc%', 8])
  })
})

describe('searchAdminUsers', () => {
  it('经 ilikeStrategy 搜 username/email + deleted_at 守卫 + 参数 [%q%, limit]', async () => {
    const { db, calls } = makeDb([{ id: 'u1', username: 'bob', email: 'b@x.io', role: 'user' }])
    const rows = await searchAdminUsers(db, 'bob', 5)
    expect(rows).toHaveLength(1)
    const { sql, params } = calls[0]!
    expect(sql).toContain('deleted_at IS NULL')
    expect(sql).toContain('(username ILIKE $1 OR email ILIKE $1)')
    expect(params).toEqual(['%bob%', 5])
  })

  it('注入自定义 matchStrategy（pg_trgm 切换口）', async () => {
    const { db, calls } = makeDb()
    const trgm = vi.fn(() => 'similarity(username, $1) > 0.3')
    await searchAdminUsers(db, 'x', 5, trgm)
    expect(trgm).toHaveBeenCalledWith(['username', 'email'], '$1')
    expect(calls[0]!.sql).toContain('similarity(username, $1) > 0.3')
  })
})

describe('searchTaskRuns', () => {
  it('title ILIKE + created_at 窗口下界 + 默认 30 天 + 参数 [days, %q%, limit]', async () => {
    const { db, calls } = makeDb([])
    await searchTaskRuns(db, { q: 'crawl', limit: 8 })
    const { sql, params } = calls[0]!
    expect(sql).toContain('created_at >= NOW() - make_interval(days => $1::int)')
    expect(sql).toContain('title ILIKE $2')
    expect(sql).toContain('ORDER BY created_at DESC')
    expect(params).toEqual([30, '%crawl%', 8])
  })

  it('自定义 sinceDays 透传', async () => {
    const { db, calls } = makeDb([])
    await searchTaskRuns(db, { q: 'x', limit: 4, sinceDays: 7 })
    expect(calls[0]!.params).toEqual([7, '%x%', 4])
  })
})
