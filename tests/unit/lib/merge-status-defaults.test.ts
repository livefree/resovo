/**
 * merge-status-defaults.test.ts — 操作内状态设置前端真源（CHG-VIR-13-D2 / D-105-9 + 设计 §4.4）
 *
 * 覆盖：
 *  1. 矩阵镜像一致性（核心守护）：前端 LEGAL_DESIRED 与后端 status-helpers 覆盖矩阵
 *     双向逐 cell 对照——任意一侧漂移即红（R-105-T7 第一层防线与第二层守门同源）
 *  2. SPLIT_STATUS_OPTIONS 全部经后端矩阵从 pending|internal 单步可达
 *  3. 智能默认规则表（设计 §4.4 六行 + 工作区受限输入 + 数据不足不猜测）
 *  4. describeStatusTransition：仅 failed 产提示（R-105-T3 人工处理路径）
 */
import { describe, it, expect } from 'vitest'
import type { ReviewStatus, VisibilityStatus } from '@resovo/types'
import {
  legalStatusOptions,
  suggestMergeTargetStatus,
  describeStatusTransition,
  GENERIC_STATUS_OPTIONS,
  SPLIT_STATUS_OPTIONS,
  type StatusPair,
} from '../../../apps/server-next/src/lib/merge/status-defaults'
// 后端矩阵真源（纯函数，不触 DB）：镜像一致性对照
import { resolveStatusAction } from '../../../apps/api/src/services/VideoMergesService.status-helpers'

const LEGAL_STATES: ReadonlyArray<StatusPair> = [
  { reviewStatus: 'pending_review', visibilityStatus: 'internal' },
  { reviewStatus: 'pending_review', visibilityStatus: 'hidden' },
  { reviewStatus: 'approved', visibilityStatus: 'public' },
  { reviewStatus: 'approved', visibilityStatus: 'internal' },
  { reviewStatus: 'approved', visibilityStatus: 'hidden' },
  { reviewStatus: 'rejected', visibilityStatus: 'hidden' },
]

const ALL_REVIEW: readonly ReviewStatus[] = ['pending_review', 'approved', 'rejected']
const ALL_VISIBILITY: readonly VisibilityStatus[] = ['public', 'internal', 'hidden']

describe('legalStatusOptions — 与后端矩阵镜像一致性（双向逐 cell）', () => {
  for (const current of LEGAL_STATES) {
    const currentKey = `${current.reviewStatus}|${current.visibilityStatus}`
    it(`current=${currentKey}：选项集 = 后端单步可达集 + keep`, () => {
      const options = legalStatusOptions(current)
      // keep 恒存在且唯一 null
      expect(options.filter((o) => o.value === null)).toHaveLength(1)
      const offeredKeys = new Set(
        options
          .filter((o) => o.value !== null)
          .map((o) => `${o.value!.reviewStatus}|${o.value!.visibilityStatus}`),
      )
      for (const dReview of ALL_REVIEW) {
        for (const dVisibility of ALL_VISIBILITY) {
          const desiredKey = `${dReview}|${dVisibility}`
          if (desiredKey === currentKey) {
            // noop 由 keep 表达，不在 desired 选项中
            expect(offeredKeys.has(desiredKey)).toBe(false)
            continue
          }
          // 后端可达性裁定
          let backendReachable: boolean
          try {
            const action = resolveStatusAction(current, { reviewStatus: dReview, visibilityStatus: dVisibility })
            backendReachable = action !== null
          } catch {
            backendReachable = false
          }
          expect(offeredKeys.has(desiredKey), `${currentKey} → ${desiredKey}`).toBe(backendReachable)
        }
      }
    })
  }

  it('非法 current（理论不可达，watchdog 管辖）→ 仅 keep', () => {
    const options = legalStatusOptions({ reviewStatus: 'rejected', visibilityStatus: 'public' })
    expect(options).toHaveLength(1)
    expect(options[0]!.value).toBeNull()
  })
})

describe('SPLIT_STATUS_OPTIONS / GENERIC_STATUS_OPTIONS — 白名单组合（R-105-T7）', () => {
  it('SPLIT 选项全部经后端矩阵从 pending|internal 单步可达（§10.1 裁定 #1）', () => {
    const initial: StatusPair = { reviewStatus: 'pending_review', visibilityStatus: 'internal' }
    for (const opt of SPLIT_STATUS_OPTIONS) {
      if (opt.value === null) continue
      // 不抛 = 合法（approve / approve_and_publish）
      expect(() => resolveStatusAction(initial, opt.value!)).not.toThrow()
    }
    // 默认项 = keep（默认待审）
    expect(SPLIT_STATUS_OPTIONS[0]!.value).toBeNull()
  })

  it('GENERIC 选项非 null value 均为合法三元组投影（无 pending|public / rejected 非 hidden）', () => {
    for (const opt of GENERIC_STATUS_OPTIONS) {
      if (opt.value === null) continue
      const { reviewStatus, visibilityStatus } = opt.value
      // 双维齐备的组合须是合法三元组投影
      if (reviewStatus !== undefined && visibilityStatus !== undefined) {
        expect(`${reviewStatus}|${visibilityStatus}`).not.toBe('pending_review|public')
        if (reviewStatus === 'rejected') expect(visibilityStatus).toBe('hidden')
      }
    }
  })
})

describe('suggestMergeTargetStatus — 设计 §4.4 智能默认规则表', () => {
  const P_I = { reviewStatus: 'pending_review', visibilityStatus: 'internal' } as const
  const A_P = { reviewStatus: 'approved', visibilityStatus: 'public', isPublished: true } as const
  const A_I = { reviewStatus: 'approved', visibilityStatus: 'internal' } as const
  const R_H = { reviewStatus: 'rejected', visibilityStatus: 'hidden' } as const

  it('规则 6（最高优先）：任意含 rejected source → 不自动升级 + 人工复核提示', () => {
    const s = suggestMergeTargetStatus(P_I, [A_P, R_H])
    expect(s.suggested).toBeNull()
    expect(s.hint).toContain('已拒绝')
  })

  it('规则 1：target 已公开 → 保持（无建议无提示）', () => {
    expect(suggestMergeTargetStatus(A_P, [P_I, A_I])).toEqual({ suggested: null, hint: null })
  })

  it('规则 2：target=pending + 某 source 已公开 → 建议 approve 单步效果 (approved, internal)（publish 留运营确认）', () => {
    const s = suggestMergeTargetStatus(P_I, [A_P])
    expect(s.suggested).toEqual({ reviewStatus: 'approved', visibilityStatus: 'internal' })
    expect(s.hint).toContain('已发布')
  })

  it('规则 3：target=approved|internal + 某 source public → 建议 approve_and_publish', () => {
    const s = suggestMergeTargetStatus(A_I, [A_P])
    expect(s.suggested).toEqual({ reviewStatus: 'approved', visibilityStatus: 'public' })
    expect(s.hint).toContain('public')
  })

  it('工作区受限输入（仅 isPublished）：target 未发布 + source 已发布 → 仅提示不建议值', () => {
    const s = suggestMergeTargetStatus({ isPublished: false }, [{ isPublished: true }])
    expect(s.suggested).toBeNull()
    expect(s.hint).toContain('已公开')
  })

  it('工作区受限输入：target 已发布（isPublished 兜底等效 public）→ 保持', () => {
    expect(suggestMergeTargetStatus({ isPublished: true }, [{ isPublished: true }])).toEqual({
      suggested: null,
      hint: null,
    })
  })

  it('数据不足（全字段缺失）→ 不猜测', () => {
    expect(suggestMergeTargetStatus({}, [{}, {}])).toEqual({ suggested: null, hint: null })
  })

  it('普通场景（target pending + source 均未公开）→ 无建议', () => {
    expect(suggestMergeTargetStatus(P_I, [P_I])).toEqual({ suggested: null, hint: null })
  })
})

describe('describeStatusTransition — R-105-T3 失败可观测', () => {
  it('failed → warn 提示人工处理路径', () => {
    const note = describeStatusTransition('failed')
    expect(note?.level).toBe('warn')
    expect(note?.text).toContain('审核台')
  })

  it('applied / skipped / 未请求 → null 不打扰', () => {
    expect(describeStatusTransition('applied')).toBeNull()
    expect(describeStatusTransition('skipped')).toBeNull()
    expect(describeStatusTransition(undefined)).toBeNull()
  })
})
