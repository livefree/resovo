/**
 * video-ref-applied.test.ts — ADR-216 DC-216-1 谓词契约守护
 *
 * 验证 videoRefAppliedSql / isVideoRefApplied 单一真源（共享 VIDEO_REF_APPLIED_MATCH_STATUSES）
 * + is_primary 强制（Codex r2 C-1 invariant）+ 阈值含 auto_matched（等价旧 matched）
 * + JS↔SQL 同源 + 不引入第三套状态域。
 */
import { describe, it, expect } from 'vitest'
import { EXTERNAL_REF_MATCH_STATUSES } from '@resovo/types'
import type { ExternalRefMatchStatus } from '@resovo/types'
import {
  VIDEO_REF_APPLIED_MATCH_STATUSES,
  isVideoRefApplied,
  videoRefAppliedSql,
} from '@/api/db/queries/video-ref-applied'

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
