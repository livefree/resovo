/**
 * cleanup-tmdb-season-refs.test.ts — classifyStaleSeasonRef 纯函数单测（ADR-207 D-207-9b）
 *
 * mock 脚本的重依赖（postgres/tmdb/tmdb-config/catalogExternalRefs）使 import 零副作用；
 * VITEST 守卫 + 这些 mock 共同保证不触 main()/db/网络，仅验证检测逻辑分支。
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/api/lib/postgres', () => ({ db: {} }))
vi.mock('@/api/lib/tmdb', () => ({ getTvDetail: vi.fn() }))
vi.mock('@/api/services/tmdb-config', () => ({ loadTmdbClientConfig: vi.fn() }))
vi.mock('@/api/db/queries/catalogExternalRefs', () => ({ demoteExactRef: vi.fn() }))

import { classifyStaleSeasonRef } from '../../../scripts/cleanup-tmdb-season-refs'
import type { TmdbTvDetail, TmdbTvSeason } from '@/api/lib/tmdb.types'

const season = (over: Partial<TmdbTvSeason>): TmdbTvSeason => ({
  id: 3624, name: 'S1', overview: '', poster_path: null, air_date: null, episode_count: 10, season_number: 1, vote_average: 0, ...over,
})
const show = (seasons: TmdbTvSeason[]): TmdbTvDetail => ({ id: 1399, seasons } as unknown as TmdbTvDetail)

describe('classifyStaleSeasonRef (ADR-207 D-207-9b)', () => {
  it('show=null（external_id 非有效 show id，getTvDetail 404）→ 非 stale（实为季 id，跳过）', () => {
    expect(classifyStaleSeasonRef(null, 1, '3624')).toEqual({ stale: false })
  })

  it('external_id=show id 1399，命中季正确 id=3624 ≠ 1399 → stale + correctSeasonId', () => {
    const s = show([season({ id: 3624, season_number: 1 })])
    expect(classifyStaleSeasonRef(s, 1, '1399')).toEqual({ stale: true, correctSeasonId: 3624 })
  })

  it('external_id 已是正确季 id 3624（== 命中季 id）→ 非 stale', () => {
    const s = show([season({ id: 3624, season_number: 1 })])
    expect(classifyStaleSeasonRef(s, 1, '3624')).toEqual({ stale: false })
  })

  it('show 无对应季号（仅 S2，请求 S1）→ 保守非 stale（无法判定）', () => {
    const s = show([season({ id: 3625, season_number: 2 })])
    expect(classifyStaleSeasonRef(s, 1, '1399')).toEqual({ stale: false })
  })

  it('show.seasons 缺失 → 非 stale', () => {
    expect(classifyStaleSeasonRef({ id: 1399 } as unknown as TmdbTvDetail, 1, '1399')).toEqual({ stale: false })
  })
})
