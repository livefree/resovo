/**
 * video-ref-applied.test.ts — ADR-216 DC-216-1 谓词契约守护
 *
 * 验证 videoRefAppliedSql / isVideoRefApplied 单一真源（共享 VIDEO_REF_APPLIED_MATCH_STATUSES）
 * + is_primary 强制（Codex r2 C-1 invariant）+ 阈值含 auto_matched（等价旧 matched）
 * + JS↔SQL 同源 + 不引入第三套状态域。
 */
import { describe, it, expect } from 'vitest'
import { EXTERNAL_REF_MATCH_STATUSES } from '@resovo/types'
import type { DoubanMatchQualityStatus, DoubanStatus, ExternalRefMatchStatus } from '@resovo/types'
import {
  VIDEO_REF_APPLIED_MATCH_STATUSES,
  isVideoRefApplied,
  videoRefAppliedSql,
  matchesDoubanRefState,
  doubanRefStateSql,
  doubanRefStateFilterSql,
} from '@/api/db/queries/video-ref-applied'
import type { DoubanRefStateInput } from '@/api/db/queries/video-ref-applied'

const ALL_STATUSES: readonly ExternalRefMatchStatus[] = [
  'auto_matched',
  'manual_confirmed',
  'candidate',
  'rejected',
]

describe('VIDEO_REF_APPLIED_MATCH_STATUSES', () => {
  it('含 auto_matched + manual_confirmed（等价旧 matched），排除 candidate/rejected', () => {
    expect([...VIDEO_REF_APPLIED_MATCH_STATUSES].sort()).toEqual(['auto_matched', 'manual_confirmed'])
    expect((VIDEO_REF_APPLIED_MATCH_STATUSES as readonly string[]).includes('candidate')).toBe(false)
    expect((VIDEO_REF_APPLIED_MATCH_STATUSES as readonly string[]).includes('rejected')).toBe(false)
  })

  it('是 EXTERNAL_REF_MATCH_STATUSES 的子集（不引入第三套状态域）', () => {
    for (const s of VIDEO_REF_APPLIED_MATCH_STATUSES) {
      expect((EXTERNAL_REF_MATCH_STATUSES as readonly string[]).includes(s)).toBe(true)
    }
  })
})

describe('isVideoRefApplied — JS 侧判定', () => {
  it('强制 is_primary：applied 状态但非 primary → false（Codex r2 C-1 invariant 守护）', () => {
    expect(isVideoRefApplied('auto_matched', false)).toBe(false)
    expect(isVideoRefApplied('manual_confirmed', false)).toBe(false)
  })

  it('is_primary + applied 状态 → true', () => {
    expect(isVideoRefApplied('auto_matched', true)).toBe(true)
    expect(isVideoRefApplied('manual_confirmed', true)).toBe(true)
  })

  it('candidate/rejected/null → false（即便 primary）', () => {
    expect(isVideoRefApplied('candidate', true)).toBe(false)
    expect(isVideoRefApplied('rejected', true)).toBe(false)
    expect(isVideoRefApplied(null, true)).toBe(false)
  })

  it('真值表与「is_primary AND status∈applied」一致（四态 × 两 primary）', () => {
    for (const status of ALL_STATUSES) {
      for (const isPrimary of [true, false]) {
        const expected =
          isPrimary && (VIDEO_REF_APPLIED_MATCH_STATUSES as readonly string[]).includes(status)
        expect(isVideoRefApplied(status, isPrimary)).toBe(expected)
      }
    }
  })
})

describe('videoRefAppliedSql — SQL 谓词', () => {
  it('含 EXISTS / video_id 关联 / provider 字面量 / is_primary=true / 阈值 IN', () => {
    const sql = videoRefAppliedSql('douban')
    expect(sql).toContain('EXISTS (SELECT 1 FROM video_external_refs ver')
    expect(sql).toContain('ver.video_id = v.id')
    expect(sql).toContain("ver.provider = 'douban'")
    expect(sql).toContain('ver.is_primary = true')
    expect(sql).toContain("ver.match_status IN ('auto_matched', 'manual_confirmed')")
  })

  it('自定义 video alias 生效', () => {
    expect(videoRefAppliedSql('bangumi', 'vid')).toContain('ver.video_id = vid.id')
  })

  it('JS↔SQL 同源：SQL 的 IN 集合 == VIDEO_REF_APPLIED_MATCH_STATUSES，且不含被排除态', () => {
    const sql = videoRefAppliedSql('tmdb')
    for (const s of VIDEO_REF_APPLIED_MATCH_STATUSES) {
      expect(sql).toContain(`'${s}'`)
    }
    expect(sql).not.toContain("'candidate'")
    expect(sql).not.toContain("'rejected'")
  })

  it('强制 is_primary（契约不可漏，Codex r2 C-1）', () => {
    expect(videoRefAppliedSql('imdb')).toContain('ver.is_primary = true')
  })
})

// ── video 级 douban 4 态过滤谓词（ADR-216 D-216-10/13 / META-58-B-1）──────────

const DOUBAN_STATES: readonly DoubanStatus[] = ['matched', 'candidate', 'unmatched', 'pending']

/** 枚举全部 input 组合（refs 事实 × douban_match_status 信号，含中间态）。 */
function allInputs(): DoubanRefStateInput[] {
  const dmsValues: (DoubanMatchQualityStatus | null)[] =
    ['auto_matched', 'candidate', 'manual_confirmed', 'unmatched', null]
  const out: DoubanRefStateInput[] = []
  for (const hasApplied of [true, false])
    for (const hasCandidate of [true, false])
      for (const doubanMatchStatus of dmsValues)
        out.push({ hasApplied, hasCandidate, doubanMatchStatus })
  return out
}

describe('matchesDoubanRefState — 穷尽四分 + 互斥（D-216-10/13）', () => {
  it('任意 input 恰好命中 1 态（穷尽互斥，无 gap/重叠）', () => {
    for (const input of allInputs()) {
      const hits = DOUBAN_STATES.filter((s) => matchesDoubanRefState(s, input))
      expect(hits.length).toBe(1)
    }
  })

  it('matched 仅看 hasApplied，优先级覆盖 candidate/unmatched/pending', () => {
    const both: DoubanRefStateInput =
      { hasApplied: true, hasCandidate: true, doubanMatchStatus: 'unmatched' }
    expect(matchesDoubanRefState('matched', both)).toBe(true)
    expect(matchesDoubanRefState('candidate', both)).toBe(false)
    expect(matchesDoubanRefState('unmatched', both)).toBe(false)
  })

  it('candidate = NOT applied AND hasCandidate', () => {
    expect(matchesDoubanRefState('candidate',
      { hasApplied: false, hasCandidate: true, doubanMatchStatus: null })).toBe(true)
    expect(matchesDoubanRefState('candidate',
      { hasApplied: true, hasCandidate: true, doubanMatchStatus: null })).toBe(false)
  })

  it('unmatched = NOT applied AND NOT candidate AND dms=unmatched（candidate ref 拦截）', () => {
    expect(matchesDoubanRefState('unmatched',
      { hasApplied: false, hasCandidate: false, doubanMatchStatus: 'unmatched' })).toBe(true)
    expect(matchesDoubanRefState('unmatched',
      { hasApplied: false, hasCandidate: true, doubanMatchStatus: 'unmatched' })).toBe(false)
  })

  it('pending 兜底：NOT applied/candidate 且 dms≠unmatched（含 NULL never enrich + 中间态，穷尽非 gap）', () => {
    expect(matchesDoubanRefState('pending',
      { hasApplied: false, hasCandidate: false, doubanMatchStatus: null })).toBe(true)
    for (const dms of ['auto_matched', 'candidate', 'manual_confirmed'] as const) {
      expect(matchesDoubanRefState('pending',
        { hasApplied: false, hasCandidate: false, doubanMatchStatus: dms })).toBe(true)
    }
    expect(matchesDoubanRefState('pending',
      { hasApplied: false, hasCandidate: false, doubanMatchStatus: 'unmatched' })).toBe(false)
  })
})

describe('doubanRefStateSql — SQL 谓词结构（JS↔SQL 对拍铁律）', () => {
  it('matched ≡ videoRefAppliedSql(douban)（applied primary，无 NOT）', () => {
    expect(doubanRefStateSql('matched')).toBe(videoRefAppliedSql('douban', 'v'))
    expect(doubanRefStateSql('matched')).not.toContain('NOT ')
  })

  it('candidate 含 match_status=candidate，且 candidate-ref 子查询 **不含 is_primary**（D-216-10 恒空 bug 守护）', () => {
    const sql = doubanRefStateSql('candidate')
    expect(sql).toContain("ver.match_status = 'candidate'")
    const candidateExists = sql.slice(sql.lastIndexOf('EXISTS'))
    expect(candidateExists).not.toContain('is_primary')
  })

  it('unmatched 引用 meta_quality.douban_match_status=unmatched（越出纯 refs 边界）', () => {
    const sql = doubanRefStateSql('unmatched')
    expect(sql).toContain("douban_match_status') = 'unmatched'")
  })

  it('pending 兜底用 IS DISTINCT FROM unmatched（NULL-safe，不依赖 enriched_at）', () => {
    const sql = doubanRefStateSql('pending')
    expect(sql).toContain("douban_match_status') IS DISTINCT FROM 'unmatched'")
    expect(sql).not.toContain('enriched_at')
  })

  it('unmatched/pending SQL 同 dms 列二分穷尽（= vs IS DISTINCT FROM）', () => {
    expect(doubanRefStateSql('unmatched')).toContain("= 'unmatched'")
    expect(doubanRefStateSql('pending')).toContain("IS DISTINCT FROM 'unmatched'")
  })

  it('candidate/unmatched/pending 均以 NOT applied 起（互斥前置）', () => {
    for (const s of ['candidate', 'unmatched', 'pending'] as const) {
      expect(doubanRefStateSql(s)).toContain('(NOT EXISTS')
    }
  })

  it('自定义 video alias 透传', () => {
    expect(doubanRefStateSql('candidate', 'vid')).toContain('ver.video_id = vid.id')
  })
})

describe('doubanRefStateFilterSql — 多态过滤迁移（旧 ANY 列）', () => {
  it('单态 ≡ doubanRefStateSql', () => {
    expect(doubanRefStateFilterSql(['matched'])).toBe(doubanRefStateSql('matched'))
  })

  it('多态 OR 组合（外层括号）', () => {
    const sql = doubanRefStateFilterSql(['matched', 'candidate'])
    expect(sql.startsWith('(')).toBe(true)
    expect(sql).toContain(' OR ')
  })

  it('去重：重复态只生成一次（≡ 单态）', () => {
    expect(doubanRefStateFilterSql(['matched', 'matched'])).toBe(doubanRefStateSql('matched'))
  })

  it('空集 → false（防御，调用方应先 guard length）', () => {
    expect(doubanRefStateFilterSql([])).toBe('false')
  })
})
