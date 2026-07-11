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

describe('listVideos — sort=hot 改用 video_hot_scores 物化热度真源（STATS-05-B / ADR-216 D-216-3）', () => {
  it('sort=hot：LEFT JOIN video_hot_scores + 统一排序口径，不再用 active source count 占位', async () => {
    const { db, calls } = makePool()
    await listVideos(db, { sort: 'hot', page: 1, limit: 20 })

    const rows = rowsCall(calls)
    // hot 物化表 LEFT JOIN（PK video_id additive）
    expect(rows.text).toContain('LEFT JOIN video_hot_scores vhs ON vhs.video_id = v.id')
    // 统一排序口径（D-216-3）：hot_score DESC NULLS LAST → play_count_7d → total_play_count → updated_at
    expect(rows.text).toContain('vhs.hot_score DESC NULLS LAST')
    expect(rows.text).toContain('vhs.play_count_7d DESC NULLS LAST')
    expect(rows.text).toContain('vpt.total_play_count DESC NULLS LAST')
    expect(rows.text).toMatch(/ORDER BY[\s\S]*v\.updated_at DESC/)
    // 不再用活跃源计数排序（占位已替换）
    expect(rows.text).not.toMatch(/ORDER BY\s*\(\s*SELECT COUNT/)
  })

  it('非 hot 排序（rating/latest/updated）：不引入无谓 video_hot_scores join', async () => {
    for (const sort of ['rating', 'latest', 'updated'] as const) {
      const { db, calls } = makePool()
      await listVideos(db, { sort, page: 1, limit: 20 })
      const rows = rowsCall(calls)
      expect(rows.text).not.toContain('video_hot_scores')
    }
  })

  it('sort 缺省（latest）：不引入 video_hot_scores join', async () => {
    const { db, calls } = makePool()
    await listVideos(db, { page: 1, limit: 20 })
    const rows = rowsCall(calls)
    expect(rows.text).not.toContain('video_hot_scores')
    expect(rows.text).toContain('v.created_at DESC')
  })

  it('sort=hot：COUNT 查询不附加 hot join（LEFT JOIN 不影响计数）', async () => {
    const { db, calls } = makePool()
    await listVideos(db, { sort: 'hot', page: 1, limit: 20 })
    // 注：rows 查询的 source_count 子查询也含 COUNT(*) → 用「无 ORDER BY」区分真正的计数查询
    const countCall = calls.find((c) => !/ORDER BY/.test(c.text))
    expect(countCall).toBeDefined()
    expect(countCall!.text).toContain('SELECT COUNT(*)')
    expect(countCall!.text).not.toContain('video_hot_scores')
  })
})
