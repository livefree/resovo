/**
 * metadata-status-sort-filter-sql.test.ts — 视频库元数据排序/过滤动态 SQL 真实 PG 集成（META-32-B / ADR-201）
 *
 * 防回归（mock 单测盲区）：
 *   1. 动态 LATERAL JOIN（嵌套 derived table 引用外层 v/mc + GREATEST + IN-list + ::int[]/::timestamptz cast）
 *      在真实 PG 的可执行性——结构错/类型推断错（参 BUGFIX-RENDERCHECK-PLAYBACK-SQL-CAST 教训）mock 全程隐藏。
 *   2. **口径一致性红线**：SQL 派生的 metadata_status_rank / issue_rank / 四源 state 必须与 JS
 *      buildMetadataStatusSummary 逐值相等（视频库排序/过滤与列内显示同口径）。
 *
 * 只读（不改 dev DB 数据，对齐 integration-pg 约定）；空库时仅退化为可执行性断言。
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'
import { createIntegrationPool } from '../../helpers/integration-pg'
import { listAdminVideos } from '@/api/db/queries/videos'
import {
  METADATA_STATUS_JOIN_SQL,
  getMetadataProviderRefs,
  buildMetadataStatusSummary,
  toMetadataStatusSourceRow,
} from '@/api/db/queries/metadata-status.derive'
import { VIDEO_FULL_SELECT, VIDEO_JOIN } from '@/api/db/queries/videos.internal'
import { METADATA_PROVIDERS } from '@resovo/types'

let db: Pool

beforeAll(() => {
  db = createIntegrationPool()
})

afterAll(async () => {
  await db.end()
})

describe('listAdminVideos 元数据动态 SQL 可执行性（真实 PG 不抛）', () => {
  it('sortField=metadata_status（挂 LATERAL + ORDER BY md.metadata_status_rank）执行不抛', async () => {
    const res = await listAdminVideos(db, { status: 'all', sortField: 'metadata_status', sortDir: 'asc', page: 1, limit: 10 })
    expect(Array.isArray(res.rows)).toBe(true)
    expect(typeof res.total).toBe('number')
  })

  it('sortField=metadata_score（v.meta_score 直通，不挂 LATERAL）执行不抛', async () => {
    const res = await listAdminVideos(db, { status: 'all', sortField: 'metadata_score', sortDir: 'desc', page: 1, limit: 10 })
    expect(Array.isArray(res.rows)).toBe(true)
  })

  it('overall/providerState/issue 多选 + updated 范围 + 四快捷组合过滤执行不抛（::int[]/::timestamptz cast + 四源 OR）', async () => {
    const res = await listAdminVideos(db, {
      status: 'all',
      metadataOverall: ['needs_review', 'candidate', 'missing', 'partial', 'complete'],
      metadataProviderState: ['applied', 'candidate', 'problem', 'missing', 'not_applicable'],
      metadataIssueLevel: ['none', 'info', 'warn', 'danger'],
      metadataUpdatedFrom: '2000-01-01T00:00:00Z',
      metadataUpdatedTo: '2100-01-01T00:00:00Z',
      metadataNeedsReview: false,
      metadataHasCandidate: false,
      metadataMissing: false,
      metadataTmdbPending: false,
      page: 1,
      limit: 10,
    })
    expect(Array.isArray(res.rows)).toBe(true)
  })

  it('元数据快捷筛选（needs_review / has_candidate / missing / tmdb_pending）执行不抛', async () => {
    for (const flag of ['metadataNeedsReview', 'metadataHasCandidate', 'metadataMissing', 'metadataTmdbPending'] as const) {
      const res = await listAdminVideos(db, { status: 'all', [flag]: true, page: 1, limit: 5 })
      expect(Array.isArray(res.rows)).toBe(true)
    }
  })
})

describe('SQL 派生 ↔ JS 派生口径一致（METADATA_STATUS_JOIN_SQL vs buildMetadataStatusSummary）', () => {
  it('现有行抽样：rank / issueRank / 四源 state 逐值相等（红线守护）', async () => {
    // SQL 侧：动态 JOIN 直接产出 rank/issue/四源 state
    const sqlRes = await db.query<{
      id: string; catalog_id: string; rank: number; issue: number
      md_douban_state: string; md_bangumi_state: string; md_tmdb_state: string; md_imdb_state: string
    }>(
      `SELECT v.id, v.catalog_id,
              md.metadata_status_rank AS rank, md.metadata_issue_rank AS issue,
              md.md_douban_state, md.md_bangumi_state, md.md_tmdb_state, md.md_imdb_state
         FROM videos v JOIN media_catalog mc ON mc.id = v.catalog_id
         ${METADATA_STATUS_JOIN_SQL}
        WHERE v.deleted_at IS NULL
        ORDER BY v.created_at DESC
        LIMIT 200`,
    )

    if (sqlRes.rows.length === 0) return // 空库：仅可执行性断言（上方 describe 覆盖）

    const ids = sqlRes.rows.map((r) => r.id)
    const rowsRes = await db.query(
      `SELECT ${VIDEO_FULL_SELECT} ${VIDEO_JOIN} WHERE v.id = ANY($1::uuid[])`, [ids],
    )
    const refsMap = await getMetadataProviderRefs(
      db, rowsRes.rows.map((r) => ({ id: r.id, catalogId: r.catalog_id })),
    )
    const jsById = new Map(
      rowsRes.rows.map((row) => [row.id, buildMetadataStatusSummary(toMetadataStatusSourceRow(row, refsMap.get(row.id) ?? []))]),
    )

    const mismatches: string[] = []
    for (const sr of sqlRes.rows) {
      const js = jsById.get(sr.id)
      if (!js) continue
      if (Number(sr.rank) !== js.sort.statusRank) {
        mismatches.push(`${sr.id} rank sql=${sr.rank} js=${js.sort.statusRank} overall=${js.overall}`)
      }
      if (Number(sr.issue) !== js.sort.issueRank) {
        mismatches.push(`${sr.id} issue sql=${sr.issue} js=${js.sort.issueRank}`)
      }
      for (const p of METADATA_PROVIDERS) {
        const sqlState = (sr as unknown as Record<string, string>)[`md_${p}_state`]
        if (sqlState !== js.providers[p].state) {
          mismatches.push(`${sr.id} ${p} state sql=${sqlState} js=${js.providers[p].state}`)
        }
      }
    }
    expect(mismatches).toEqual([])
  })
})
