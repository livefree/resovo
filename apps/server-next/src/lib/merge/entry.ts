/**
 * merge/entry.ts — `/admin/merge` 深链构造单一真源（CHG-VIR-13-A1 / 设计 §4.1 域 A）
 *
 * 收口动机：6 处入口（视频库行级 / 审核台 TabSimilar / PendingCenter 拆分 /
 * 审核台批量栏 / audit rollback ?tab=）各自内联拼接 URL，参数协议无单一真源。
 * 本文件收口**现行参数形态**（candidate_a / candidate_b / candidate_id / split /
 * ids / tab / from）；CHG-VIR-13-WS 落地 mode 模型时仅改本文件内部映射 +
 * MergeClient 升级映射层，入口文件零再改。
 *
 * 参数顺序契约（与既有测试断言一致，勿调换）：
 *   merge-pair: candidate_a → candidate_b → from → candidate_id
 *   split:      split → from
 *   batch:      ids → from
 *   tab:        tab → from
 */

/** 入口来源枚举（设计 §4.1；13-A2 增补 videos-split / videos-batch） */
export const MERGE_ENTRY_SOURCES = [
  'videos',
  'moderation',
  'moderation-batch',
  'audit-rollback',
] as const

export type MergeEntrySource = (typeof MERGE_ENTRY_SOURCES)[number]

export function isMergeEntrySource(v: string | null | undefined): v is MergeEntrySource {
  return v != null && (MERGE_ENTRY_SOURCES as readonly string[]).includes(v)
}

/** 来源回链栏元数据（MergeClient 消费；label/backHref 单一真源在此） */
export const MERGE_ENTRY_SOURCE_META: Record<
  MergeEntrySource,
  { readonly label: string; readonly backHref: string; readonly backLabel: string }
> = {
  videos: { label: '来自视频库', backHref: '/admin/videos', backLabel: '返回视频库' },
  moderation: { label: '来自审核台', backHref: '/admin/moderation', backLabel: '返回审核台' },
  'moderation-batch': { label: '来自审核台批量操作', backHref: '/admin/moderation', backLabel: '返回审核台' },
  'audit-rollback': { label: '来自审计回滚', backHref: '/admin/audit', backLabel: '返回审计页' },
}

/** 深链形态（discriminated union；现行 URL 协议 / 13-WS 升级映射后仍由本类型驱动） */
export type MergeEntry =
  | {
      readonly kind: 'merge-pair'
      /** 锁定为候选 A 的 videoId */
      readonly candidateA: string
      /** 预填候选 B 的 videoId（审核台类似 tab 深链） */
      readonly candidateB?: string
      /** identity_candidate.id 锚点（confirm 透传 / ADR-178 D-178-3） */
      readonly candidateId?: string
      readonly from: MergeEntrySource
    }
  | { readonly kind: 'split'; readonly videoId: string; readonly from: MergeEntrySource }
  | { readonly kind: 'batch-merge'; readonly ids: readonly string[]; readonly from: MergeEntrySource }
  | {
      readonly kind: 'tab'
      readonly tab: 'candidates' | 'merged' | 'split'
      readonly from?: MergeEntrySource
    }

/** 统一构造 /admin/merge 深链（所有入口必须经由本函数，禁止内联拼接） */
export function buildMergeHref(entry: MergeEntry): string {
  const qs = new URLSearchParams()
  switch (entry.kind) {
    case 'merge-pair':
      qs.set('candidate_a', entry.candidateA)
      if (entry.candidateB) qs.set('candidate_b', entry.candidateB)
      qs.set('from', entry.from)
      if (entry.candidateId) qs.set('candidate_id', entry.candidateId)
      break
    case 'split':
      qs.set('split', entry.videoId)
      qs.set('from', entry.from)
      break
    case 'batch-merge':
      qs.set('ids', entry.ids.join(','))
      qs.set('from', entry.from)
      break
    case 'tab':
      qs.set('tab', entry.tab)
      if (entry.from) qs.set('from', entry.from)
      break
  }
  return `/admin/merge?${qs.toString()}`
}
