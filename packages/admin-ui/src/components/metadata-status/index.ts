/**
 * metadata-status/index.ts — 元数据状态展示原语公开 API（ADR-201 / META-33）
 *
 * 真源：metadata-status.types.ts（arch-reviewer Opus CONDITIONAL-PASS 契约）。
 *
 * 消费方（P3 接入，本卡不接）：审核详情 TabDetail（META-34）/ 视频编辑抽屉（META-35）/ 视频库列（META-36）。
 * -A：MetadataSourceIconCluster + MetadataProviderIcon + buildMetadataTooltip + 文案常量。
 * -B：MetadataStatusPanel（待补）。
 */

// ── 组件 ──────────────────────────────────────────────────────────────────────
export { MetadataProviderIcon } from './metadata-provider-icon'
export { MetadataSourceIconCluster } from './metadata-source-icon-cluster'

// ── 共享 tooltip 构造器 ───────────────────────────────────────────────────────
export { buildMetadataTooltip } from './metadata-tooltip'

// ── 文案常量（C8：导出供 META-36 视频库筛选 UI 复用，避免三处各拼）────────────────
export {
  PROVIDER_STATE_LABEL,
  OVERALL_LABEL,
  NEXT_ACTION_LABEL,
  ISSUE_LEVEL_LABEL,
  MATCH_METHOD_LABEL,
  ISSUE_CODE_LABEL,
  PROVIDER_STATE_VISUAL,
  ICON_DOT_TOKEN,
} from './metadata-status-labels'
export type { MetadataIconDot } from './metadata-status-labels'

// ── 类型 ──────────────────────────────────────────────────────────────────────
export type {
  MetadataIconSize,
  MetadataProviderIconProps,
  MetadataClusterDensity,
  MetadataSourceIconClusterProps,
  MetadataTooltipOptions,
  MetadataTooltipModel,
} from './metadata-status.types'
