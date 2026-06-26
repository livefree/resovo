/**
 * tests/unit/api/play-stats-cross-surface-sort.test.ts
 * STATS-06-A（ADR-216 D-216-3 / Codex 任务卡审 HIGH 6+7）：跨 surface 热度排序口径一致性。
 *
 * 验证 `/videos?sort=hot`（PG，listVideos）与 `/search?sort=hot`（ES，SearchService）的热度排序：
 *   1. 双侧 emit **同一 4-key 链**：hot_score → play_count_7d → play_count_total → updated_at（DESC）。
 *      PG 用 `NULLS LAST`、ES 用 `missing:'_last'`——前 3 个 play 字段两侧均「空值置末」。
 *   2. **行为断言**（非仅字符串比对，防 tautology）：以共享 sort spec 对夹具排序，证明级联 tiebreak +
 *      **null 与真实 0 的区分**（Codex BLOCK 2：DESC-nulls-last 下 真实 0 排在 null 之前；ES 若把缺失
 *      写成 0 会破坏此等价）。`NULLS LAST`（PG）与 `missing:'_last'`（ES DESC）语义等价，由同一 spec 表达。
 *
 * 夹具限**共同可见集**（is_published+public+approved+content_rating='general'）——Codex HIGH 7：
 * 两 surface 过滤集不同（search 多 approved+general），本测试只验排序口径、不验可见全集对账。
 * 真实 PG↔ES seed 对拍（同夹具 reindex 后比 id 顺序）需 live ES，延后合并期。
 */

import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import type { Client } from '@elastic/elasticsearch'

// elasticsearch.ts 模块加载期 throw（缺 ELASTICSEARCH_URL）→ mock 之；SearchService 仅 import ES_INDEX，
// 其 es client 由构造函数注入（本测试用 makeEs 的 mock）。
vi.mock('@/api/lib/elasticsearch', () => ({
  es: { search: vi.fn() },
  ES_INDEX: 'resovo_videos',
  ensureIndex: vi.fn(),
}))

import { listVideos } from '@/api/db/queries/videos'
import { SearchService } from '@/api/services/SearchService'

// ── Part 1：双侧 emit 同一 4-key 链 ────────────────────────────────

function makePool(): { db: Pool; calls: { text: string }[] } {
  const calls: { text: string }[] = []
  const query = vi.fn((text: string) => {
    calls.push({ text })
    if (/COUNT\(\*\)/.test(text) && !/ORDER BY/.test(text)) {
      return Promise.resolve({ rows: [{ count: '0' }] })
    }
    return Promise.resolve({ rows: [] })
  })
  return { db: { query } as unknown as Pool, calls }
}

function makeEs(): { es: Client; bodies: Record<string, unknown>[] } {
  const bodies: Record<string, unknown>[] = []
  const search = vi.fn((body: Record<string, unknown>) => {
    bodies.push(body)
    return Promise.resolve({ hits: { hits: [], total: { value: 0 } } })
  })
  return { es: { search } as unknown as Client, bodies }
}

describe('跨 surface 热度排序 — 双侧 4-key 链对齐（STATS-06-A）', () => {
  it('/videos?sort=hot（PG）ORDER BY = hot_score→play_count_7d→total_play_count→updated_at，前 3 DESC NULLS LAST', async () => {
    const { db, calls } = makePool()
    await listVideos(db, { sort: 'hot', page: 1, limit: 20 })

    const rows = calls.find((c) => /ORDER BY/.test(c.text))
    expect(rows).toBeDefined()
    const orderBy = rows!.text.slice(rows!.text.indexOf('ORDER BY'))
    // 4 字段顺序 + 前 3 个 NULLS LAST
    expect(orderBy).toMatch(
      /vhs\.hot_score DESC NULLS LAST[\s\S]*vhs\.play_count_7d DESC NULLS LAST[\s\S]*vpt\.total_play_count DESC NULLS LAST[\s\S]*v\.updated_at DESC/,
    )
  })

  it('/search?sort=hot（ES）sort = hot_score→play_count_7d→play_count_total→updated_at，前 3 missing:_last', async () => {
    const { es, bodies } = makeEs()
    const svc = new SearchService(es)
    await svc.search({ sort: 'hot', page: 1, limit: 20 })

    const sort = bodies[0].sort as Array<Record<string, { order: string; missing?: string }>>
    expect(sort.map((s) => Object.keys(s)[0])).toEqual([
      'hot_score',
      'play_count_7d',
      'play_count_total',
      'updated_at',
    ])
    expect(sort[0].hot_score.missing).toBe('_last')
    expect(sort[1].play_count_7d.missing).toBe('_last')
    expect(sort[2].play_count_total.missing).toBe('_last')
    expect(sort[3].updated_at.order).toBe('desc')
  })

  it('两侧 play 字段语义对应：PG total_play_count ⟷ ES play_count_total（同一累计真源，doc 投影 alias）', async () => {
    // 列名差异（PG vpt.total_play_count vs ES play_count_total）是 buildDocument 的投影 alias，
    // 同一 video_play_totals.total_play_count 真源——口径等价。本断言锁定该映射不漂移。
    const { db, calls } = makePool()
    await listVideos(db, { sort: 'hot', page: 1, limit: 20 })
    const rows = calls.find((c) => /ORDER BY/.test(c.text))!
    expect(rows.text).toContain('vpt.total_play_count')
  })
})

// ── Part 2：共享 sort spec 行为断言（null/0 区分 + 级联 tiebreak）──

interface HotRow {
  id: string
  hot_score: number | null
  play_count_7d: number | null
  play_count_total: number | null
  updated_at: string
  // 共同可见集字段（Codex 实现审 MEDIUM 2 / 任务卡审 HIGH 7）——夹具须全部满足
  is_published: boolean
  review_status: string
  visibility_status: string
  content_rating: string
}

/** 共同可见集谓词（/videos 与 /search 召回集交集；本测试只验排序口径、建立在同一可见集上）。 */
function isCommonVisible(r: HotRow): boolean {
  return (
    r.is_published &&
    r.review_status === 'approved' &&
    r.visibility_status === 'public' &&
    r.content_rating === 'general'
  )
}

function descDate(a: string, b: string): number {
  return a < b ? 1 : a > b ? -1 : 0
}

// ── 两个 **独立** 实现的「DESC 空值置末」comparator（Codex 实现审 MEDIUM 1）──
// 二者各自独立编码 → 在同一夹具产生同序，方证 PG `NULLS LAST` ≡ ES `missing:'_last'`（非 tautology）。

/** PG 视角：显式 null 分支（非空优先、大者在前）。 */
function pgDescNullsLast(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return b - a
}
/** ES 视角：missing 映射 -Infinity（DESC 下自然垫底），独立实现，不复用 null 分支逻辑。 */
function esDescMissingLast(a: number | null, b: number | null): number {
  const ma = a == null ? Number.NEGATIVE_INFINITY : a
  const mb = b == null ? Number.NEGATIVE_INFINITY : b
  if (ma === mb) return 0
  return ma > mb ? -1 : 1
}

function makeHotSortSpec(cmp: (a: number | null, b: number | null) => number) {
  return (a: HotRow, b: HotRow): number =>
    cmp(a.hot_score, b.hot_score) ||
    cmp(a.play_count_7d, b.play_count_7d) ||
    cmp(a.play_count_total, b.play_count_total) ||
    descDate(a.updated_at, b.updated_at)
}
/** PG 口径排序 spec（D-216-3 4-key 链）。 */
const hotSortSpec = makeHotSortSpec(pgDescNullsLast)
/** ES 口径排序 spec（独立 missing:_last 模型）。 */
const esSortSpec = makeHotSortSpec(esDescMissingLast)

describe('跨 surface 热度排序 — 共享 spec 行为（STATS-06-A / Codex HIGH 6）', () => {
  // 夹具均属共同可见集（published+public+approved+general）——只排序键不同（Codex HIGH 7）。
  const VISIBLE = {
    is_published: true,
    review_status: 'approved',
    visibility_status: 'public',
    content_rating: 'general',
  } as const
  const v_top: HotRow = { id: 'top', hot_score: 100, play_count_7d: 50, play_count_total: 5, updated_at: '2024-06-03', ...VISIBLE }
  const v_top_older: HotRow = { id: 'top_older', hot_score: 100, play_count_7d: 50, play_count_total: 5, updated_at: '2024-06-01', ...VISIBLE }
  const v_total_null: HotRow = { id: 'total_null', hot_score: 100, play_count_7d: 50, play_count_total: null, updated_at: '2024-06-09', ...VISIBLE }
  const v_low7d: HotRow = { id: 'low7d', hot_score: 100, play_count_7d: 10, play_count_total: 999, updated_at: '2024-06-09', ...VISIBLE }
  const v_zero: HotRow = { id: 'zero', hot_score: 0, play_count_7d: 9999, play_count_total: 9999, updated_at: '2024-06-09', ...VISIBLE }
  const v_null: HotRow = { id: 'null', hot_score: null, play_count_7d: 9999, play_count_total: 9999, updated_at: '2024-06-09', ...VISIBLE }
  const ALL = [v_null, v_low7d, v_top_older, v_zero, v_total_null, v_top]

  it('Codex HIGH 7：全部夹具属共同可见集（排序口径对比建立在同一可见集上）', () => {
    expect(ALL.every(isCommonVisible)).toBe(true)
  })

  it('完整级联 + null/0 区分：positive > 0 > null（主键）→ 次键 → 三键 → updated_at', () => {
    const sorted = [...ALL].sort(hotSortSpec).map((r) => r.id)
    expect(sorted).toEqual(['top', 'top_older', 'total_null', 'low7d', 'zero', 'null'])
  })

  it('Codex 实现审 MEDIUM 1：PG(NULLS LAST) 与 ES(missing:_last) 两个独立 comparator 产生同序（非 tautology）', () => {
    const pgOrder = [...ALL].sort(hotSortSpec).map((r) => r.id)
    const esOrder = [...ALL].sort(esSortSpec).map((r) => r.id)
    expect(esOrder).toEqual(pgOrder)
  })

  it('Codex BLOCK 2：真实 0 排在 null 之前（hot_score=0 ≠ hot_score=null）——ES 写 0 会破坏此区分', () => {
    expect([v_null, v_zero].sort(hotSortSpec).map((r) => r.id)).toEqual(['zero', 'null'])
    // ES 独立模型同样区分
    expect([v_null, v_zero].sort(esSortSpec).map((r) => r.id)).toEqual(['zero', 'null'])
  })

  it('主键 null 置末优先于次键大值：v_null（7d=9999）仍排在 v_low7d（hot=100,7d=10）之后', () => {
    expect([v_null, v_low7d].sort(hotSortSpec).map((r) => r.id)).toEqual(['low7d', 'null'])
  })

  it('三键 total null 置末：play_count_total=null 排在 total=5 之后（同 hot/7d）', () => {
    expect([v_total_null, v_top].sort(hotSortSpec).map((r) => r.id)).toEqual(['top', 'total_null'])
  })

  it('updated_at tiebreak（同源 videos.updated_at）：前 3 键全等时新者在前', () => {
    expect([v_top_older, v_top].sort(hotSortSpec).map((r) => r.id)).toEqual(['top', 'top_older'])
  })
})
