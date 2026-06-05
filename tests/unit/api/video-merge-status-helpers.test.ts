/**
 * video-merge-status-helpers.test.ts — (current, desired) → action 覆盖矩阵定档单测
 * （ADR-105 AMENDMENT 2026-06-04 D-105-9/10/11 / CHG-VIR-13-D1）
 *
 * D-105-9 评审 R1 定档要求：以 VideoStateTransitionAction 9 值枚举的 from-state 前置条件
 * + migration 053 DB trigger 白名单双层逐行核对，**全枚举单测 = 矩阵真源固化**
 * （6 合法 current × 9 desired 二元组 = 54 cell 逐一断言，矩阵漂移即红）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/db/queries/videos.mutations', () => ({
  transitionVideoState: vi.fn(),
}))
vi.mock('@/api/db/queries/video-merge-mutations', () => ({
  fetchVideosByIds: vi.fn(),
}))
vi.mock('@/api/lib/logger', () => ({
  baseLogger: { child: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }) },
}))

import {
  resolveStatusAction,
  applyStatusTransition,
  restoreTargetStatusBefore,
  SPLIT_INITIAL_STATE,
} from '@/api/services/VideoMergesService.status-helpers'
import * as videosMutations from '@/api/db/queries/videos.mutations'
import * as mergeMutations from '@/api/db/queries/video-merge-mutations'
import type { ReviewStatus, VisibilityStatus } from '@resovo/types'

const VIDEO_ID = '00000000-0000-0000-0000-000000000001'
const ACTOR_ID = '00000000-0000-0000-0000-000000000002'

beforeEach(() => {
  vi.clearAllMocks()
})

// ── 矩阵全枚举定档（D-105-9 实施真源）─────────────────────────────────

/** 合法 current 二元组（023 trigger 合法三元组的 (review, visibility) 投影，6 态） */
const LEGAL_STATES: ReadonlyArray<readonly [ReviewStatus, VisibilityStatus]> = [
  ['pending_review', 'internal'],
  ['pending_review', 'hidden'],
  ['approved', 'public'],
  ['approved', 'internal'],
  ['approved', 'hidden'],
  ['rejected', 'hidden'],
]

const ALL_REVIEW: readonly ReviewStatus[] = ['pending_review', 'approved', 'rejected']
const ALL_VISIBILITY: readonly VisibilityStatus[] = ['public', 'internal', 'hidden']

/**
 * 期望表：currentKey → desiredKey → action | 'noop'(null) | '422'(throw)。
 * 未列出的 desiredKey 恒 '422'（含非法二元组 pending|public / rejected|internal / rejected|public）。
 *
 * 核对依据（双层缺一即 422）：
 *   ① transitionVideoState from-state 前置（videos.mutations.ts switch）
 *   ② migration 053 trigger 转换白名单
 */
const EXPECTED: Record<string, Record<string, string>> = {
  'pending_review|internal': {
    'pending_review|internal': 'noop',
    'pending_review|hidden': 'set_hidden',
    'approved|public': 'approve_and_publish',
    'approved|internal': 'approve',
    'rejected|hidden': 'reject',
    // approved|hidden：approve 恒落 internal（034），单步不可达
  },
  'pending_review|hidden': {
    'pending_review|hidden': 'noop',
    'pending_review|internal': 'set_internal',
    'approved|public': 'approve_and_publish',
    'approved|internal': 'approve',
    'rejected|hidden': 'reject',
    // approved|hidden：trigger 留有通道但应用层 9 值枚举无单步路径
  },
  'approved|public': {
    'approved|public': 'noop',
    'approved|internal': 'unpublish',
    'approved|hidden': 'set_hidden',
    // pending|*：staging_revert 前置 !is_published，须先 unpublish 两步（M-SN-4 D-01）
    // rejected|*：reject 前置 pending_review
  },
  'approved|internal': {
    'approved|internal': 'noop',
    'approved|public': 'publish',
    'approved|hidden': 'set_hidden',
    'pending_review|internal': 'staging_revert',
    // pending|hidden：staging_revert 保持原 visibility，跨 visibility 退回不可达
  },
  'approved|hidden': {
    'approved|hidden': 'noop',
    'approved|public': 'publish',
    'approved|internal': 'set_internal',
    'pending_review|hidden': 'staging_revert',
  },
  'rejected|hidden': {
    'rejected|hidden': 'noop',
    'pending_review|hidden': 'reopen_pending',
    // pending|internal：reopen_pending 恒落 hidden（trigger 允许但应用层无单步路径）
    // approved|*：须先 reopen_pending 两步
  },
}

describe('resolveStatusAction — (current, desired) 覆盖矩阵全枚举（6×9 = 54 cell 定档）', () => {
  for (const [curReview, curVisibility] of LEGAL_STATES) {
    const currentKey = `${curReview}|${curVisibility}`
    for (const dReview of ALL_REVIEW) {
      for (const dVisibility of ALL_VISIBILITY) {
        const desiredKey = `${dReview}|${dVisibility}`
        const expected = EXPECTED[currentKey]?.[desiredKey] ?? '422'

        it(`${currentKey} → ${desiredKey} = ${expected}`, () => {
          const call = () => resolveStatusAction(
            { reviewStatus: curReview, visibilityStatus: curVisibility },
            { reviewStatus: dReview, visibilityStatus: dVisibility },
          )
          if (expected === '422') {
            let thrown: unknown
            try {
              call()
            } catch (err) {
              thrown = err
            }
            expect(thrown).toMatchObject({ code: 'VALIDATION_ERROR', httpStatus: 422 })
          } else if (expected === 'noop') {
            expect(call()).toBeNull()
          } else {
            expect(call()).toBe(expected)
          }
        })
      }
    }
  }
})

describe('resolveStatusAction — 单维缺省归一化（D-105-9：缺省维度取 current 值）', () => {
  it('仅 reviewStatus：visibility 取 current（pending|internal + {approved} → approve）', () => {
    expect(resolveStatusAction(
      { reviewStatus: 'pending_review', visibilityStatus: 'internal' },
      { reviewStatus: 'approved' },
    )).toBe('approve')
  })

  it('仅 visibilityStatus：review 取 current（approved|internal + {public} → publish）', () => {
    expect(resolveStatusAction(
      { reviewStatus: 'approved', visibilityStatus: 'internal' },
      { visibilityStatus: 'public' },
    )).toBe('publish')
  })

  it('单维归一化后 == current → null（approved|internal + {reviewStatus: approved}）', () => {
    expect(resolveStatusAction(
      { reviewStatus: 'approved', visibilityStatus: 'internal' },
      { reviewStatus: 'approved' },
    )).toBeNull()
  })

  it('单维归一化出非法态 → 422（pending|internal + {visibilityStatus: public}）', () => {
    expect(() => resolveStatusAction(
      { reviewStatus: 'pending_review', visibilityStatus: 'internal' },
      { visibilityStatus: 'public' },
    )).toThrow(/无合法单步转换路径/)
  })
})

describe('SPLIT_INITIAL_STATE（D-105-9：insertNewVideo DB DEFAULT / migration 016）', () => {
  it('恒 pending_review|internal（矩阵退化为 pending 行）', () => {
    expect(SPLIT_INITIAL_STATE).toEqual({ reviewStatus: 'pending_review', visibilityStatus: 'internal' })
  })
})

// ── applyStatusTransition（D-105-10 post-COMMIT 非原子边界）──────────────

describe('applyStatusTransition', () => {
  const db = {} as import('pg').Pool

  it('transition 成功 → applied（reviewedBy/reason 透传）', async () => {
    vi.mocked(videosMutations.transitionVideoState).mockResolvedValueOnce({
      id: VIDEO_ID,
      review_status: 'approved',
      visibility_status: 'public',
      is_published: true,
      updated_at: '2026-06-04T00:00:00Z',
    })

    const result = await applyStatusTransition(db, VIDEO_ID, 'approve_and_publish', ACTOR_ID, '合并附带过审')

    expect(result).toBe('applied')
    expect(videosMutations.transitionVideoState).toHaveBeenCalledExactlyOnceWith(
      db, VIDEO_ID,
      { action: 'approve_and_publish', reviewedBy: ACTOR_ID, reason: '合并附带过审' },
    )
  })

  it('返回 null（video 不存在/软删）→ failed', async () => {
    vi.mocked(videosMutations.transitionVideoState).mockResolvedValueOnce(null)
    expect(await applyStatusTransition(db, VIDEO_ID, 'approve', ACTOR_ID)).toBe('failed')
  })

  it('抛错（并发状态变更/trigger 拒绝）→ failed 不上抛（D-105-10 不回滚声明）', async () => {
    vi.mocked(videosMutations.transitionVideoState).mockRejectedValueOnce(new Error('invalid transition'))
    expect(await applyStatusTransition(db, VIDEO_ID, 'publish', ACTOR_ID)).toBe('failed')
  })
})

// ── restoreTargetStatusBefore（D-105-11 unmerge 还原）──────────────────

describe('restoreTargetStatusBefore', () => {
  const db = {} as import('pg').Pool
  const BEFORE = { reviewStatus: 'approved', visibilityStatus: 'internal', isPublished: false } as const

  function mockCurrentRow(review: string, visibility: string, deletedAt: string | null = null) {
    vi.mocked(mergeMutations.fetchVideosByIds).mockResolvedValueOnce([
      {
        id: VIDEO_ID,
        review_status: review,
        visibility_status: visibility,
        deleted_at: deletedAt,
      } as Awaited<ReturnType<typeof mergeMutations.fetchVideosByIds>>[number],
    ])
  }

  it('target 不存在 → failed', async () => {
    vi.mocked(mergeMutations.fetchVideosByIds).mockResolvedValueOnce([])
    expect(await restoreTargetStatusBefore(db, VIDEO_ID, BEFORE, ACTOR_ID)).toBe('failed')
    expect(videosMutations.transitionVideoState).not.toHaveBeenCalled()
  })

  it('target 已软删 → failed', async () => {
    mockCurrentRow('approved', 'public', '2026-06-04T00:00:00Z')
    expect(await restoreTargetStatusBefore(db, VIDEO_ID, BEFORE, ACTOR_ID)).toBe('failed')
    expect(videosMutations.transitionVideoState).not.toHaveBeenCalled()
  })

  it('current == before → skipped（不调状态机）', async () => {
    mockCurrentRow('approved', 'internal')
    expect(await restoreTargetStatusBefore(db, VIDEO_ID, BEFORE, ACTOR_ID)).toBe('skipped')
    expect(videosMutations.transitionVideoState).not.toHaveBeenCalled()
  })

  it('单步可达（approved|public → approved|internal = unpublish）→ applied', async () => {
    mockCurrentRow('approved', 'public')
    vi.mocked(videosMutations.transitionVideoState).mockResolvedValueOnce({
      id: VIDEO_ID,
      review_status: 'approved',
      visibility_status: 'internal',
      is_published: false,
      updated_at: '2026-06-04T00:00:00Z',
    })

    expect(await restoreTargetStatusBefore(db, VIDEO_ID, BEFORE, ACTOR_ID, '撤销合并')).toBe('applied')
    expect(videosMutations.transitionVideoState).toHaveBeenCalledExactlyOnceWith(
      db, VIDEO_ID,
      { action: 'unpublish', reviewedBy: ACTOR_ID, reason: '撤销合并' },
    )
  })

  it('无单步回路（approved|public → pending|internal）→ failed 不抛出（已知边界，两步还原须回 ADR 定档）', async () => {
    mockCurrentRow('approved', 'public')
    const before = { reviewStatus: 'pending_review', visibilityStatus: 'internal', isPublished: false } as const

    expect(await restoreTargetStatusBefore(db, VIDEO_ID, before, ACTOR_ID)).toBe('failed')
    expect(videosMutations.transitionVideoState).not.toHaveBeenCalled()
  })
})
