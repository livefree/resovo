/**
 * metadata-status-derive.test.ts — ADR-201 / META-32-A
 *
 * 验证 buildMetadataStatusSummary 纯派生（overall 优先级 1–6 / 阈值 80 / 四 key 恒在 /
 * not_applicable·missing / tmdb·imdb 占位恒 null·空 / 真源优先级 catalog>video>cache 冲突态）
 * + getMetadataProviderRefs 批量组装。
 */
import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import { METADATA_PROVIDERS, METADATA_PROVIDER_ORDER } from '@resovo/types'
import {
  buildMetadataStatusSummary,
  getMetadataProviderRefs,
  METADATA_COMPLETE_SCORE_THRESHOLD,
  METADATA_OVERALL_RANK,
  METADATA_ISSUE_RANK,
  METADATA_STATUS_JOIN_SQL,
  type MetadataStatusSourceRow,
  type ProviderRefAggregate,
} from '@/api/db/queries/metadata-status.derive'

function makeRow(over: Partial<MetadataStatusSourceRow> = {}): MetadataStatusSourceRow {
  return {
    type: 'movie',
    doubanStatus: 'pending',
    bangumiStatus: 'pending',
    metaScore: 0,
    metaQuality: null,
    doubanId: null,
    tmdbId: null,
    imdbId: null,
    bangumiSubjectId: null,
    providerRefs: [],
    fieldConflicts: [],
    ...over,
  }
}

function makeRef(over: Partial<ProviderRefAggregate> & Pick<ProviderRefAggregate, 'provider'>): ProviderRefAggregate {
  return {
    catalogRelation: null,
    catalogConfidence: null,
    catalogExternalId: null,
    videoMatchStatus: null,
    videoMatchMethod: null,
    videoConfidence: null,
    videoExternalId: null,
    videoIsPrimary: false,
    ...over,
  }
}

describe('buildMetadataStatusSummary — providers 结构', () => {
  it('providers 恒含四 key（即便全空）', () => {
    const s = buildMetadataStatusSummary(makeRow())
    expect(Object.keys(s.providers).sort()).toEqual([...METADATA_PROVIDERS].sort())
    for (const p of METADATA_PROVIDERS) expect(s.providers[p].provider).toBe(p)
  })

  it('METADATA_PROVIDER_ORDER 成员集合与 METADATA_PROVIDERS 相等（防一侧增源遗漏）', () => {
    expect([...METADATA_PROVIDER_ORDER].sort()).toEqual([...METADATA_PROVIDERS].sort())
  })
})

describe('buildMetadataStatusSummary — overall 优先级 1–6', () => {
  it('空行 → missing（无 applied/candidate/enrichedAt）', () => {
    const s = buildMetadataStatusSummary(makeRow())
    expect(s.overall).toBe('missing')
    expect(s.sort.statusRank).toBe(3)
  })

  it('provider candidate 且无 danger → candidate', () => {
    const s = buildMetadataStatusSummary(makeRow({ doubanStatus: 'candidate' }))
    expect(s.overall).toBe('candidate')
    expect(s.sort.statusRank).toBe(2)
    expect(s.issueLevel).toBe('warn')
    expect(s.nextAction).toBe('confirm_candidate')
  })

  it('applied 且 score<80 → partial', () => {
    const s = buildMetadataStatusSummary(makeRow({ doubanStatus: 'matched', metaScore: 50 }))
    expect(s.providers.douban.state).toBe('applied')
    expect(s.overall).toBe('partial')
    expect(s.sort.statusRank).toBe(4)
  })

  it('applied 且 score>=80 无 warn/danger → complete', () => {
    const s = buildMetadataStatusSummary(makeRow({ doubanStatus: 'matched', metaScore: 80 }))
    expect(s.overall).toBe('complete')
    expect(s.sort.statusRank).toBe(5)
    expect(s.nextAction).toBe('none')
  })

  it('阈值 80 边界：79 → partial / 80 → complete', () => {
    expect(buildMetadataStatusSummary(makeRow({ doubanStatus: 'matched', metaScore: 79 })).overall).toBe('partial')
    expect(buildMetadataStatusSummary(makeRow({ doubanStatus: 'matched', metaScore: 80 })).overall).toBe('complete')
    expect(METADATA_COMPLETE_SCORE_THRESHOLD).toBe(80)
  })

  it('problem + danger → needs_review', () => {
    // catalog ref rejected 但 cache 仍有 douban_id → problem/danger（D-201-E 冲突态）
    const s = buildMetadataStatusSummary(makeRow({
      doubanId: '1292052',
      providerRefs: [makeRef({ provider: 'douban', catalogRelation: 'rejected' })],
    }))
    expect(s.providers.douban.state).toBe('problem')
    expect(s.providers.douban.issueLevel).toBe('danger')
    expect(s.overall).toBe('needs_review')
    expect(s.sort.statusRank).toBe(1)
    expect(s.nextAction).toBe('review_conflict')
    expect(s.issues.some((i) => i.level === 'danger')).toBe(true)
  })

  it('字段冲突（ADR-205 M3）→ needs_review（最高优先级，即便其余 complete）+ danger issue + review_conflict', () => {
    const s = buildMetadataStatusSummary(makeRow({ doubanStatus: 'matched', metaScore: 90, fieldConflicts: ['title', 'rating'] }))
    expect(s.overall).toBe('needs_review')   // 冲突先于 provider 态 → 压过 complete
    expect(s.sort.statusRank).toBe(1)
    expect(s.issueLevel).toBe('danger')
    expect(s.sort.issueRank).toBe(METADATA_ISSUE_RANK.danger)
    expect(s.nextAction).toBe('review_conflict')
    const conflict = s.issues.find((i) => i.code === 'field_conflict')
    expect(conflict).toMatchObject({ level: 'danger', provider: null, action: 'review_conflict' })
    expect(conflict?.message).toContain('title')
    expect(conflict?.message).toContain('rating')
  })

  it('无冲突（fieldConflicts 空）→ 不注入 field_conflict issue（默认行为不变）', () => {
    const s = buildMetadataStatusSummary(makeRow({ doubanStatus: 'matched', metaScore: 90 }))
    expect(s.overall).toBe('complete')
    expect(s.issues.some((i) => i.code === 'field_conflict')).toBe(false)
  })
})

describe('buildMetadataStatusSummary — provider state', () => {
  it('bangumi 对非 anime → not_applicable（不计缺失惩罚）', () => {
    const s = buildMetadataStatusSummary(makeRow({ type: 'movie', bangumiStatus: 'pending' }))
    expect(s.providers.bangumi.state).toBe('not_applicable')
  })

  it('bangumi 对 anime pending → missing', () => {
    const s = buildMetadataStatusSummary(makeRow({ type: 'anime', bangumiStatus: 'pending' }))
    expect(s.providers.bangumi.state).toBe('missing')
  })

  it('douban unmatched → missing', () => {
    const s = buildMetadataStatusSummary(makeRow({ doubanStatus: 'unmatched' }))
    expect(s.providers.douban.state).toBe('missing')
  })

  it('tmdb/imdb cache-only → applied + 占位字段恒 null/空 + reasonCode', () => {
    const s = buildMetadataStatusSummary(makeRow({ tmdbId: 27205, imdbId: 'tt1375666', metaScore: 90 }))
    const tmdb = s.providers.tmdb
    expect(tmdb.state).toBe('applied')
    expect(tmdb.externalId).toBe('27205')
    expect(tmdb.confidence).toBeNull()
    expect(tmdb.matchMethod).toBeNull()
    expect(tmdb.appliedAt).toBeNull()
    expect(tmdb.fetchedAt).toBeNull()
    expect(tmdb.tooltipLines).toEqual([])
    expect(tmdb.reasonCodes).toContain('cache_only_no_ref')
    expect(s.providers.imdb.state).toBe('applied')
  })

  it('真源优先级：catalog exact 优先于 cache / video ref', () => {
    const s = buildMetadataStatusSummary(makeRow({
      doubanId: '999',
      providerRefs: [makeRef({
        provider: 'douban',
        catalogRelation: 'exact',
        catalogExternalId: 'canonical-1',
        videoMatchStatus: 'candidate',
        videoExternalId: 'v-1',
      })],
    }))
    expect(s.providers.douban.state).toBe('applied')           // catalog exact 胜 video candidate
    expect(s.providers.douban.externalId).toBe('canonical-1')  // catalog externalId 优先
  })

  it('video ref candidate（无 catalog ref）→ candidate', () => {
    const s = buildMetadataStatusSummary(makeRow({
      providerRefs: [makeRef({ provider: 'douban', videoMatchStatus: 'candidate', videoExternalId: 'v-2', videoConfidence: 0.6 })],
    }))
    expect(s.providers.douban.state).toBe('candidate')
    expect(s.providers.douban.confidence).toBe(0.6)
  })

  it('catalog ref 非空即终态：rejected（无 cache）即便有强 video ref auto_matched 仍 missing（SQL IS NOT NULL 兜底镜像）', () => {
    // 镜像 JS `if (ref?.catalogRelation)` 终态 + mapCatalogRelation rejected 无 cache → missing；绝不回落 video ref
    const s = buildMetadataStatusSummary(makeRow({
      doubanStatus: 'matched',  // status 列亦不应被消费（catalog 终态）
      providerRefs: [makeRef({
        provider: 'douban', catalogRelation: 'rejected', videoMatchStatus: 'auto_matched', videoExternalId: 'v-3',
      })],
    }))
    expect(s.providers.douban.state).toBe('missing')
  })

  it('primaryProvider = 显示顺序首个 applied', () => {
    const s = buildMetadataStatusSummary(makeRow({
      type: 'anime', doubanStatus: 'matched', bangumiStatus: 'matched',
    }))
    expect(s.primaryProvider).toBe('douban')  // order: douban 在 bangumi 前
  })
})

describe('getMetadataProviderRefs — 批量组装', () => {
  function mockRefsDb(videoRows: unknown[], catalogRows: unknown[]): Pool {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: videoRows })
      .mockResolvedValueOnce({ rows: catalogRows })
    return { query } as unknown as Pool
  }

  it('空输入不查库', async () => {
    const query = vi.fn()
    const db = { query } as unknown as Pool
    const map = await getMetadataProviderRefs(db, [])
    expect(map.size).toBe(0)
    expect(query).not.toHaveBeenCalled()
  })

  it('合并 video 级 + catalog 级 refs（NUMERIC 字符串转 number）', async () => {
    const db = mockRefsDb(
      [{ video_id: 'v1', provider: 'douban', match_status: 'candidate', match_method: 'title', confidence: '0.80', external_id: 'd1', is_primary: true }],
      [{ catalog_id: 'c1', provider: 'tmdb', relation: 'exact', confidence: '0.90', external_id: 't1' }],
    )
    const map = await getMetadataProviderRefs(db, [{ id: 'v1', catalogId: 'c1' }])
    const aggs = map.get('v1') ?? []
    const douban = aggs.find((a) => a.provider === 'douban')
    const tmdb = aggs.find((a) => a.provider === 'tmdb')
    expect(douban?.videoMatchStatus).toBe('candidate')
    expect(douban?.videoConfidence).toBe(0.8)
    expect(tmdb?.catalogRelation).toBe('exact')
    expect(tmdb?.catalogConfidence).toBe(0.9)
  })
})

describe('METADATA_STATUS_JOIN_SQL — 服务端排序过滤 SQL 派生（META-32-B）', () => {
  it('排序键常量与 JS sort 口径同一真源', () => {
    // 这两个 Record 同时驱动 JS sort.statusRank/issueRank 与 SQL metadata_status_rank/issue_rank
    expect(METADATA_OVERALL_RANK).toEqual({ needs_review: 1, candidate: 2, missing: 3, partial: 4, complete: 5 })
    expect(METADATA_ISSUE_RANK).toEqual({ none: 0, info: 1, warn: 2, danger: 3 })
  })

  it('是动态 LATERAL JOIN，外层别名 md', () => {
    expect(METADATA_STATUS_JOIN_SQL).toContain('LEFT JOIN LATERAL')
    expect(METADATA_STATUS_JOIN_SQL).toMatch(/\)\s*md ON true\s*$/)
  })

  it('四源 state 列齐全（供 provider state / 快捷筛选过滤）', () => {
    for (const p of METADATA_PROVIDERS) {
      expect(METADATA_STATUS_JOIN_SQL).toContain(`AS md_${p}_state`)
      expect(METADATA_STATUS_JOIN_SQL).toContain(`AS md_${p}_issue_rank`)
    }
    expect(METADATA_STATUS_JOIN_SQL).toContain('AS metadata_status_rank')
    expect(METADATA_STATUS_JOIN_SQL).toContain('AS metadata_issue_rank')
  })

  it('catalog ref 优先级 + video ref 谓词镜像 getMetadataProviderRefs DISTINCT ON', () => {
    expect(METADATA_STATUS_JOIN_SQL).toContain('FROM catalog_external_refs cer')
    expect(METADATA_STATUS_JOIN_SQL).toContain('cer.catalog_id = v.catalog_id')
    expect(METADATA_STATUS_JOIN_SQL).toContain('FROM video_external_refs ver')
    expect(METADATA_STATUS_JOIN_SQL).toContain('ver.video_id = v.id')
    expect(METADATA_STATUS_JOIN_SQL).toContain('ver.is_primary DESC')
  })

  it('overall rank 口径镜像 deriveOverall（needs_review/candidate/missing/partial/complete + 阈值 80）', () => {
    expect(METADATA_STATUS_JOIN_SQL).toContain(`THEN ${METADATA_OVERALL_RANK.needs_review}`)
    expect(METADATA_STATUS_JOIN_SQL).toContain(`THEN ${METADATA_OVERALL_RANK.candidate}`)
    expect(METADATA_STATUS_JOIN_SQL).toContain(`THEN ${METADATA_OVERALL_RANK.missing}`)
    expect(METADATA_STATUS_JOIN_SQL).toContain(`v.meta_score < ${METADATA_COMPLETE_SCORE_THRESHOLD}`)
    expect(METADATA_STATUS_JOIN_SQL).toContain(`v.meta_score >= ${METADATA_COMPLETE_SCORE_THRESHOLD}`)
    // missing 判定与 JS `!enrichedAt` 一致（空串按缺失）
    expect(METADATA_STATUS_JOIN_SQL).toContain(`NULLIF(v.meta_quality->>'enriched_at', '') IS NULL`)
  })

  it('bangumi not_applicable 分支仅对非 anime（D-201-B）', () => {
    expect(METADATA_STATUS_JOIN_SQL).toContain(`WHEN v.type <> 'anime' THEN 'not_applicable'`)
    // douban/tmdb/imdb 无 not_applicable 分支（只有 bangumi 一处）
    expect(METADATA_STATUS_JOIN_SQL.match(/'not_applicable'/g)?.length).toBe(1)
  })

  it('ref 非空即终态 + 兜底走 rejected 行为（IS NOT NULL 兜底，镜像 mapCatalogRelation/mapVideoMatchStatus；防未知值穿透 cache）', () => {
    // catch-all 用 `IS NOT NULL AND cache → problem` / `IS NOT NULL → missing`，而非字面量 `= 'rejected'`
    expect(METADATA_STATUS_JOIN_SQL).toContain(`cr_douban IS NOT NULL AND mc.douban_id IS NOT NULL THEN 'problem'`)
    expect(METADATA_STATUS_JOIN_SQL).toContain(`cr_douban IS NOT NULL THEN 'missing'`)
    expect(METADATA_STATUS_JOIN_SQL).toContain(`vr_douban IS NOT NULL AND mc.douban_id IS NOT NULL THEN 'problem'`)
    expect(METADATA_STATUS_JOIN_SQL).toContain(`THEN ${METADATA_ISSUE_RANK.danger}`)
    // 不再用字面量 = 'rejected' 兜底（未知 relation/match_status 会与 JS 分歧）
    expect(METADATA_STATUS_JOIN_SQL).not.toContain(`= 'rejected'`)
  })

  it('字段冲突镜像（ADR-205 M3）：conflict EXISTS + needs_review 首位分支 + issue GREATEST conflict danger', () => {
    // 镜像 JS hasFieldConflict：metadata_field_proposals.conflict_state 非空 → needs_review
    expect(METADATA_STATUS_JOIN_SQL).toContain('FROM metadata_field_proposals mfp')
    expect(METADATA_STATUS_JOIN_SQL).toContain('mfp.catalog_id = v.catalog_id')
    expect(METADATA_STATUS_JOIN_SQL).toContain('mfp.conflict_state IS NOT NULL')
    // overallRank 首个 WHEN = conflict EXISTS → needs_review（最高优先级，先于 problem）
    expect(METADATA_STATUS_JOIN_SQL).toMatch(
      new RegExp(`WHEN EXISTS \\(SELECT 1 FROM metadata_field_proposals[\\s\\S]*?THEN ${METADATA_OVERALL_RANK.needs_review}\\s*\\n\\s*WHEN 'problem'`),
    )
    // issue rank GREATEST 含 conflict danger 分支
    expect(METADATA_STATUS_JOIN_SQL).toContain(`THEN ${METADATA_ISSUE_RANK.danger} ELSE 0 END) AS metadata_issue_rank`)
  })

  it('不拼接用户输入（纯静态常量 SQL）', () => {
    expect(METADATA_STATUS_JOIN_SQL).not.toContain('$')
    expect(METADATA_STATUS_JOIN_SQL).not.toContain('undefined')
  })
})
