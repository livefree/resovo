/**
 * status-defaults.ts — merge/split 操作内状态设置：前端矩阵镜像 + 智能默认（CHG-VIR-13-D2）
 *
 * ADR-105 AMENDMENT 2026-06-04 D-105-9 + 设计 §4.4 智能默认规则表。
 * R-105-T7 三层防线第一层：本文件只产状态机白名单组合（矩阵唯一真源 =
 * `apps/api/src/services/VideoMergesService.status-helpers.ts` 的 (current,desired)
 * 覆盖矩阵，本镜像与其逐行同步——后端 54 cell 全枚举单测定档，前端镜像漂移由
 * status-defaults 规则表单测守护）；后端 422 终守门；DB trigger 023/053 兜底。
 */

import type { ReviewStatus, VisibilityStatus, VideoStatusSetting, StatusTransitionOutcome } from '@resovo/types'
// CHG-VIR-13-I18N：状态语义文案集中字典（labels/hints/transition 提示真源迁移）
import { MERGE_M } from '@/i18n/messages/zh-CN/merge'

/** 已知状态二元组（候选路径 D-105-7 透出 / split 新建固定 pending|internal） */
export interface StatusPair {
  readonly reviewStatus: ReviewStatus
  readonly visibilityStatus: VisibilityStatus
}

/** 状态设置选项（null = 保持不变 / 不传，R-105-T1 前端侧零字段） */
export interface StatusOption {
  /** 选项稳定键（select value / 测试锚点） */
  readonly key: string
  readonly value: VideoStatusSetting | null
  readonly label: string
}

const KEEP_OPTION: StatusOption = { key: 'keep', value: null, label: MERGE_M.statusControl.keep }

/** 二元组 → 展示文案（合法三元组投影；真源 = i18n merge.ts / CHG-VIR-13-I18N） */
const PAIR_LABELS: Readonly<Record<string, string>> = MERGE_M.statusPair

/**
 * 13-D1 矩阵镜像：current 二元组 → 单步可达 desired 集合。
 * 与后端 TRANSITION_MATRIX 逐行同步（详细核对依据见后端文件注释）。
 */
const LEGAL_DESIRED: Record<string, readonly string[]> = {
  'pending_review|internal': ['pending_review|hidden', 'approved|public', 'approved|internal', 'rejected|hidden'],
  'pending_review|hidden': ['pending_review|internal', 'approved|public', 'approved|internal', 'rejected|hidden'],
  'approved|public': ['approved|internal', 'approved|hidden'],
  'approved|internal': ['approved|public', 'approved|hidden', 'pending_review|internal'],
  'approved|hidden': ['approved|public', 'approved|internal', 'pending_review|hidden'],
  'rejected|hidden': ['pending_review|hidden'],
}

function pairToSetting(key: string): VideoStatusSetting {
  const [reviewStatus, visibilityStatus] = key.split('|') as [ReviewStatus, VisibilityStatus]
  return { reviewStatus, visibilityStatus }
}

/**
 * current 已知 → 矩阵镜像产出「保持不变 + 单步可达 desired」选项集（只产白名单组合）。
 * current 不在合法 6 态（理论不可达，watchdog 管辖）→ 仅「保持不变」。
 */
export function legalStatusOptions(current: StatusPair): readonly StatusOption[] {
  const currentKey = `${current.reviewStatus}|${current.visibilityStatus}`
  const desired = LEGAL_DESIRED[currentKey] ?? []
  return [
    KEEP_OPTION,
    ...desired.map((key) => ({ key, value: pairToSetting(key), label: PAIR_LABELS[key] ?? key })),
  ]
}

/**
 * current 未知（MergeWorkspace 成员 = PickerVideoItem 仅 isPublished）→ 通用白名单组合
 * （合法三元组投影；单步可达性由后端矩阵 422 终守门，failed/422 经 toast 提示）。
 */
export const GENERIC_STATUS_OPTIONS: readonly StatusOption[] = [
  KEEP_OPTION,
  { key: 'approved|public', value: pairToSetting('approved|public'), label: PAIR_LABELS['approved|public']! },
  { key: 'approved|internal', value: pairToSetting('approved|internal'), label: PAIR_LABELS['approved|internal']! },
  { key: 'visibility-hidden', value: { visibilityStatus: 'hidden' }, label: MERGE_M.statusControl.hiddenOnly },
]

/**
 * split 新建 video 固定选项（current 恒 pending|internal / migration 016 DEFAULT；
 * §10.1 裁定 #1：默认待审 + 面板一键通过）。全部 ∈ 矩阵 pending|internal 行。
 */
export const SPLIT_STATUS_OPTIONS: readonly StatusOption[] = [
  { key: 'keep', value: null, label: MERGE_M.statusControl.splitKeep },
  { key: 'approved|internal', value: pairToSetting('approved|internal'), label: MERGE_M.statusControl.splitApprove },
  { key: 'approved|public', value: pairToSetting('approved|public'), label: MERGE_M.statusControl.splitApprovePublish },
]

// ── 智能默认（设计 §4.4 规则表 / first-match）──────────────────────────

export interface StatusSuggestion {
  /** 建议预选值（null = 保持不变） */
  readonly suggested: VideoStatusSetting | null
  /** 提示文案（null = 无提示） */
  readonly hint: string | null
}

const NO_SUGGESTION: StatusSuggestion = { suggested: null, hint: null }

interface StatusLike {
  readonly reviewStatus?: ReviewStatus
  readonly visibilityStatus?: VisibilityStatus
  readonly isPublished?: boolean
}

/** 等效 approved|public 判断（trigger 不变量：published ⇔ approved+public，isPublished 可兜底缺失字段） */
function isEffectivelyPublic(s: StatusLike): boolean {
  return s.isPublished === true || (s.reviewStatus === 'approved' && s.visibilityStatus === 'public')
}

/**
 * merge target 状态智能默认（设计 §4.4 规则表；字段缺失〔legacy 候选降级 / PickerVideoItem〕
 * 安全回退「不建议」——数据不足不猜测，绝不在 current 不可知时产出建议值）。
 */
export function suggestMergeTargetStatus(
  target: StatusLike,
  sources: readonly StatusLike[],
): StatusSuggestion {
  // 规则 6：任意含 rejected source → 不自动升级
  if (sources.some((s) => s.reviewStatus === 'rejected')) {
    return { suggested: null, hint: MERGE_M.statusHints.rejectedSource }
  }
  // 规则 1：target 已公开（source 均非 public 与否都保持——target 已是最高可见性）
  if (isEffectivelyPublic(target)) return NO_SUGGESTION
  const someSourcePublic = sources.some(isEffectivelyPublic)
  // 规则 2：target=pending + 某 source 已公开 → 建议升 approved（publish 需运营确认）。
  // 建议值取 approve 单步效果 (approved, internal)（双维 = 矩阵选项可匹配预选，
  // 与 legalStatusOptions 'approved|internal' 对齐；公开须运营显式选 approved|public）
  if (target.reviewStatus === 'pending_review' && someSourcePublic) {
    return {
      suggested: { reviewStatus: 'approved', visibilityStatus: 'internal' },
      hint: MERGE_M.statusHints.sourcePublishedAskSync,
    }
  }
  // 规则 3：target=approved|internal + 某 source public → 建议 approve_and_publish
  if (target.reviewStatus === 'approved' && target.visibilityStatus === 'internal' && someSourcePublic) {
    return {
      suggested: { reviewStatus: 'approved', visibilityStatus: 'public' },
      hint: MERGE_M.statusHints.sourcePublicWillLose,
    }
  }
  // 工作区受限输入（target 状态不可知仅 isPublished）：source 含公开内容时仅提示不建议值
  if (target.reviewStatus === undefined && someSourcePublic) {
    return { suggested: null, hint: MERGE_M.statusHints.workspaceLimited }
  }
  return NO_SUGGESTION
}

// ── statusTransition 响应消费（D-105-10 / R-105-T3 可观测）─────────────────

/**
 * post-COMMIT 状态写入结果 → 用户提示。failed 必须可见（非原子声明的人工处理路径）；
 * applied/skipped/未请求 → null（不打扰）。
 */
export function describeStatusTransition(
  result: StatusTransitionOutcome | undefined,
): { readonly level: 'warn'; readonly text: string } | null {
  if (result !== 'failed') return null
  return {
    level: 'warn',
    text: MERGE_M.statusTransition.failed,
  }
}
