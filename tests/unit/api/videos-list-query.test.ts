/**
 * tests/unit/api/videos-list-query.test.ts
 * HANDOFF-38：listVideos 查询层 SQL 生成断言（genre / lang 维筛选）
 *
 * 用 mocked Pool 调真实 listVideos，验证条件 SQL 构造：
 *   - lang 命中 → 生成 EXISTS(video_sources … audio_language = $N) 子查询 + 活跃源过滤
 *   - lang 未给 → SQL 不含 audio_language（不附加无谓子查询）
 *   - NULL 语义 → EXISTS 用等值 `audio_language = $N`（非 IS DISTINCT），
 *     SQL 三值逻辑下 audio_language IS NULL 自然不命中（ADR-199 D-199-7 裁定）
 *   - genre 命中 → 复用既有 mc.genres @> ARRAY[$N::text]（GIN idx_catalog_genres）
 */

import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import { listVideos } from '@/api/db/queries/videos'

interface QueryCall {
  text: string
  values?: unknown[]
}

/** 构造记录 SQL 的 mock Pool：rows 查询（含 ORDER BY）返回空，COUNT 查询返回 0 */
function makePool(): { db: Pool; calls: QueryCall[] } {
  const calls: QueryCall[] = []
  const query = vi.fn((text: string, values?: unknown[]) => {
    calls.push({ text, values })
    if (/COUNT\(\*\)/.test(text)) {
      return Promise.resolve({ rows: [{ count: '0' }] })
    }
    return Promise.resolve({ rows: [] })
  })
  return { db: { query } as unknown as Pool, calls }
}

/** 取 rows 查询（含 ORDER BY 的那条，非 COUNT） */
function rowsCall(calls: QueryCall[]): QueryCall {
  const found = calls.find((c) => /ORDER BY/.test(c.text))
  if (!found) throw new Error('rows query not found')
  return found
}

describe('listVideos — genre / lang 维筛选 SQL 生成（HANDOFF-38）', () => {
  it('lang 命中：生成 EXISTS(video_sources … audio_language = $N) + 活跃源过滤', async () => {
    const { db, calls } = makePool()
    await listVideos(db, { lang: '粤语', page: 1, limit: 20 })

    const rows = rowsCall(calls)
    expect(rows.text).toContain('EXISTS (')
    expect(rows.text).toContain('FROM video_sources')
    expect(rows.text).toContain('audio_language =')
    // 镜像 SOURCE_COUNT_SUBQUERY 的活跃源过滤
    expect(rows.text).toContain('is_active = true')
    expect(rows.text).toContain('deleted_at IS NULL')
    // 等值谓词（非 IS DISTINCT）→ NULL 三值逻辑自然不命中
    expect(rows.text).not.toContain('IS DISTINCT FROM')
    // lang 值作为参数化绑定（不拼接字符串）
    expect(rows.values).toContain('粤语')
  })

  it('lang 未给：SQL 不含 audio_language（不附加无谓子查询）', async () => {
    const { db, calls } = makePool()
    await listVideos(db, { page: 1, limit: 20 })

    const rows = rowsCall(calls)
    expect(rows.text).not.toContain('audio_language')
    expect(rows.text).not.toContain('EXISTS (')
  })

  it('genre 命中：复用既有 mc.genres @> ARRAY[$N::text]', async () => {
    const { db, calls } = makePool()
    await listVideos(db, { genre: 'action', page: 1, limit: 20 })

    const rows = rowsCall(calls)
    expect(rows.text).toContain('mc.genres @> ARRAY[')
    expect(rows.values).toContain('action')
  })

  it('genre + lang 同时命中：两条件均入 WHERE，参数化绑定齐全', async () => {
    const { db, calls } = makePool()
    await listVideos(db, { genre: 'comedy', lang: '国语', page: 1, limit: 20 })

    const rows = rowsCall(calls)
    expect(rows.text).toContain('mc.genres @> ARRAY[')
    expect(rows.text).toContain('EXISTS (')
    expect(rows.values).toContain('comedy')
    expect(rows.values).toContain('国语')
  })

  it('COUNT 查询与 rows 查询共用同一 WHERE（lang EXISTS 同时出现在两条）', async () => {
    const { db, calls } = makePool()
    await listVideos(db, { lang: '日语', page: 1, limit: 20 })

    const countCall = calls.find((c) => /COUNT\(\*\)/.test(c.text))
    expect(countCall).toBeDefined()
    expect(countCall!.text).toContain('audio_language =')
    // COUNT 查询不附加 limit/offset，params 仅含 filter 段
    expect(countCall!.values).toContain('日语')
  })
})
