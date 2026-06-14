/**
 * metadata-status.types.ts — 元数据状态展示原语公开 Props 契约（ADR-201 / META-33）
 *
 * 真源：arch-reviewer (claude-opus-4-8, agentId a910e6bb5fa5df2a7) CONDITIONAL-PASS 契约。
 *
 * 后台审核详情 / 视频编辑抽屉 / 视频库三处统一消费 `MetadataStatusSummary`（@resovo/types，
 * META-32-A 派生），下沉两 admin-ui 原语避免重复实现：
 *   - `MetadataSourceIconCluster`（紧凑四来源图标簇 + 统一 tooltip）— META-33-A
 *   - `MetadataStatusPanel`（detail/drawer/compact 详情面板）— META-33-B
 *
 * 不变约束（对齐 enrichment-badge / cell 层先例）：
 *   - 依赖方向单向：admin-ui → @resovo/types，不 import apps/server-next|api/**
 *   - 全部 Props readonly
 *   - Edge Runtime 兼容（纯展示，模块顶层零 fetch/cookie）
 *   - 零硬编码颜色（仅 CSS 变量 token）
 *   - i18n / 时间格式化不下沉（消费方格式化后传入，对齐 EnrichmentBadgeCluster.enrichedAtLabel）
 *
 * 旧 `EnrichmentBadgeCluster` / `SourceLogoBadge` / `ExternalMetaPanel` 进退役路径
 * （ADR-201 D-201-2 + §取代关系），新代码不得新增其消费点。本目录复用 enrichment-logos.ts
 * 数据资产（data-URI / label / href builder），但**不复用退役组件**（DEV-33-1 / 红线 R1）。
 */

import type { ReactNode } from 'react'
import type {
  MetadataNextAction,
  MetadataProvider,
  MetadataProviderState,
  MetadataProviderStatus,
  MetadataStatusSummary,
} from '@resovo/types'

// ── 单图标原语（MetadataProviderIcon）─────────────────────────────────────────

/** 图标尺寸：sm=16px（table）/ md=20px（header/panel）/ lg=24px（panel 放大）。走组件内映射，业务侧不传裸 px。 */
export type MetadataIconSize = 'sm' | 'md' | 'lg'

/**
 * 单来源图标原语 Props（承载 `MetadataProviderState` 五态，含 ADR-201 新增 problem 红点 +
 * not_applicable 灰显）。复用 enrichment-logos.ts 的 logo 数据资产，不复用退役 SourceLogoBadge。
 */
export interface MetadataProviderIconProps {
  readonly provider: MetadataProvider
  /** 来源状态（来自 `summary.providers[provider].state`，五态）。 */
  readonly state: MetadataProviderState
  /** 命中外部页链接；省略 / missing / not_applicable → 裸 img 无 <a>。 */
  readonly href?: string
  /** 默认 'sm'。 */
  readonly size?: MetadataIconSize
  /**
   * hover/title 复合语义文案（如「豆瓣：已应用」）。省略时据 provider+state 经文案表派生兜底。
   * ⚠ 在 cluster 内由 cluster 统一接管 a11y（受控 tooltip），单图标 title 仅作渐进增强兜底。
   */
  readonly title?: string
  readonly testId?: string
}

// ── 图标簇原语（MetadataSourceIconCluster）────────────────────────────────────

/** 簇上下文密度：table=视频库列紧凑 / header=抽屉头 / panel=面板内放大。 */
export type MetadataClusterDensity = 'table' | 'header' | 'panel'

/**
 * 四来源图标簇 Props（固定顺序 Douban / Bangumi / TMDB / IMDb；hover+focus 统一 tooltip）。
 *
 * 三密度均渲染**全部四图标**（含 missing/not_applicable 灰显占位，D-201-B：列宽/扫描稳定），
 * 与旧 `EnrichmentBadgeCluster` row 密度「仅命中」相反（DEV-33-2）。
 */
export interface MetadataSourceIconClusterProps {
  readonly summary: MetadataStatusSummary
  readonly density: MetadataClusterDensity
  /**
   * 是否在图标后附完整度微文案（如 `72`）。默认 false。
   * 仅 density='header'|'panel' 生效；density='table' 忽略（不挤占图标，ADR-201 §视频库）。
   */
  readonly showScore?: boolean
  /** 整个簇的 a11y 名（如「元数据状态：部分增强」）。省略 → 据 summary.overall 派生。 */
  readonly ariaLabel?: string
  /**
   * tooltip 时间行文案（消费方格式化 summary.enrichedAt 后传入；i18n/时间库不下沉）。
   * 省略 → tooltip 首行省略「最近 …」段。对齐 EnrichmentBadgeCluster.enrichedAtLabel 先例。
   */
  readonly enrichedAtLabel?: string
  readonly testId?: string
}

// ── 共享 tooltip 构造器模型（buildMetadataTooltip 输出）────────────────────────

/** tooltip 构造器可选注入（消费方格式化文案，不下沉 i18n/时间库）。 */
export interface MetadataTooltipOptions {
  /** summary.enrichedAt 格式化文案；省略 → 不渲染 headline「最近 …」段。 */
  readonly enrichedAtLabel?: string
}

/**
 * 结构化 tooltip 行模型（非裸 string[]，便于 cluster 渲染全量纯文本、panel 按段取用，
 * 避免 panel 二次解析字符串）。被 -A cluster 与 -B panel 共用。
 */
export interface MetadataTooltipModel {
  /** 首行：`元数据：{overall}[ · 完整度 {score}][ · 最近 {enrichedAtLabel}]`，缺字段降级省略。 */
  readonly headline: string
  /** provider 行，固定 4 行，按 METADATA_PROVIDER_ORDER。 */
  readonly providerLines: readonly string[]
  /** issue 行，≤3；溢出时末行为「另有 N 个问题」。 */
  readonly issueLines: readonly string[]
  /** 下一步：`下一步：{nextAction}`；nextAction==='none' → undefined（不渲染）。 */
  readonly nextActionLine?: string
}

// ── 状态面板原语（MetadataStatusPanel / META-33-B）────────────────────────────

/** 面板上下文 variant：detail=审核详情展开 / drawer=编辑抽屉 / compact=折叠摘要。 */
export type MetadataPanelVariant = 'detail' | 'drawer' | 'compact'

/** 动作回调（面板不执行 provider API，仅回传意图）。provider 省略=整体级 / 带=来源卡级。 */
export type MetadataActionHandler = (action: MetadataNextAction, provider?: MetadataProvider) => void

/**
 * 单来源卡 Props（面板内四来源同级展示；复用 MetadataProviderIcon + 真源字段）。
 * 内部子组件契约，随 panel 一并导出供测试/高级消费方。
 */
export interface MetadataSourceCardProps {
  readonly status: MetadataProviderStatus
  /** 来源卡级动作回调（candidate/problem 态附操作按钮时触发）。 */
  readonly onAction?: MetadataActionHandler
  readonly testId?: string
}

/**
 * 元数据状态面板 Props（ADR-201 §审核详情 / §视频编辑；arch-reviewer §5 契约）。
 *
 * 展示整体状态 + 完整度 + 最近增强 + 四来源卡 + 问题列表 + 下一步动作。**不执行 provider API**，
 * 动作仅经 `onAction` 回传上层（DEV-33-3：仅承载 `MetadataNextAction`，编辑细粒度操作归 META-35）。
 */
export interface MetadataStatusPanelProps {
  readonly summary: MetadataStatusSummary
  readonly variant: MetadataPanelVariant
  /** 动作回调（整体级 nextAction 主按钮 + 来源卡级 per-provider 动作）。 */
  readonly onAction?: MetadataActionHandler
  /** enrichedAt 格式化文案；消费方注入（i18n/时间库不下沉）。 */
  readonly enrichedAtLabel?: string
  /**
   * 「来源证据」子区内容（原始外部 ref 展示，ADR-201 §审核详情）。消费方注入 ReactNode，
   * admin-ui 不内嵌 externalRefs 取数/类型（守单向依赖）。省略 / variant='compact' → 不渲染。
   */
  readonly sourceEvidence?: ReactNode
  readonly testId?: string
}
