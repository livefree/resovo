/**
 * metadata-status-labels.ts — 元数据状态中文文案 + 视觉档位映射（ADR-201 / META-33）
 *
 * 纯 `Record` 数据层，**零 react / 零 JSX import**（C1）：供单测零渲染对拍，避免 cluster/panel 循环依赖。
 *
 * 全部映射用 `@resovo/types` const 枚举派生 key（`Record<Enum, string>`），provider/state 增量时
 * TS 编译期强制补全（可扩展性）。文案表 **导出至 barrel**（C8）：META-36 视频库筛选 UI 复用同一份
 * 文案（过滤项「已应用/待确认/异常/未获取/不适用」等），避免三处各拼违反「3 处以上必提取」。
 *
 * 范式对齐 external-meta-panel 的 MATCH_METHOD_LABEL（值复制，不 import 退役组件，红线 R1）。
 */

import type {
  MetadataIssueLevel,
  MetadataNextAction,
  MetadataProviderState,
  MetadataStatusOverall,
} from '@resovo/types'

// ── provider / overall / action / issue 文案 ────────────────────────────────

/** 单来源状态中文（图标 a11y / tooltip / 筛选项）。 */
export const PROVIDER_STATE_LABEL: Record<MetadataProviderState, string> = {
  applied: '已应用',
  candidate: '待确认',
  problem: '异常',
  missing: '未获取',
  not_applicable: '不适用',
}

/** 整体状态中文（overall 文案 / 筛选项）。 */
export const OVERALL_LABEL: Record<MetadataStatusOverall, string> = {
  needs_review: '需复核',
  candidate: '待确认',
  missing: '未增强',
  partial: '部分增强',
  complete: '已增强',
}

/** 下一步动作中文（panel 主操作按钮 / tooltip 下一步行）。 */
export const NEXT_ACTION_LABEL: Record<MetadataNextAction, string> = {
  run_enrichment: '重新增强',
  confirm_candidate: '确认候选',
  review_conflict: '复核冲突',
  improve_fields: '补全字段',
  configure_provider: '配置凭证',
  none: '—',
}

/** 问题等级中文（panel issue 视觉辅助文案）。 */
export const ISSUE_LEVEL_LABEL: Record<MetadataIssueLevel, string> = {
  none: '无',
  info: '说明',
  warn: '提醒',
  danger: '冲突',
}

/**
 * 匹配方式文案（tooltip / panel 来源卡「靠什么匹配上」）。
 * 值复制自 external-meta-panel MATCH_METHOD_LABEL（D-172-AMD3-2 范式），未知方式回退原始串（不丢信息）。
 * panel 自带映射不依赖退役组件（C10 / R1）。
 */
export const MATCH_METHOD_LABEL: Record<string, string> = {
  imdb_id: 'IMDb ID',
  title: '标题',
  title_norm: '标题',
  alias: '别名',
  network: '网络搜索',
  manual: '人工',
  manual_fields: '人工字段',
}

/**
 * 问题码中文（tooltip / panel issue 行）。issue.code 真源见 metadata-status.derive.ts。
 * 未知 code 回退 issue.message（已是英文友好名，可接受；不裸露原始 code 给运营）。
 */
export const ISSUE_CODE_LABEL: Record<string, string> = {
  candidate_unconfirmed: '候选尚未应用',
  provider_conflict: '来源冲突需复核',
  ref_rejected_cache_present: '候选被拒但缓存存在',
  // 前瞻（TMDB/冲突治理接入后产出）：
  id_conflict: '外部 ID 冲突',
  cache_without_ref: '仅缓存无来源关系',
}

// ── 视觉档位（图标灰显 + 角标）─────────────────────────────────────────────────

/** 角标类型（null=无角标）。映射到 token 在组件内：warning→--state-warning-fg / error→--state-error-fg。 */
export type MetadataIconDot = 'warning' | 'error' | null

/**
 * 五态 → 视觉档位（零硬编码颜色，C3）：
 *   applied        全彩 / 无角标
 *   candidate      全彩 / 黄点（warning）
 *   problem        全彩 / 红点（error，⚠ 是 error 非 danger token，R2）
 *   missing        灰显 / 无角标
 *   not_applicable 灰显 / 无角标（tooltip 含「不适用」由 state 文案承载）
 */
export const PROVIDER_STATE_VISUAL: Record<
  MetadataProviderState,
  { readonly grayscale: boolean; readonly dot: MetadataIconDot }
> = {
  applied: { grayscale: false, dot: null },
  candidate: { grayscale: false, dot: 'warning' },
  problem: { grayscale: false, dot: 'error' },
  missing: { grayscale: true, dot: null },
  not_applicable: { grayscale: true, dot: null },
}

/** 角标类型 → CSS 变量 token（零硬编码色）。 */
export const ICON_DOT_TOKEN: Record<'warning' | 'error', string> = {
  warning: 'var(--state-warning-fg)',
  error: 'var(--state-error-fg)',
}
