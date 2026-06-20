/**
 * image-candidate-picker.types.ts — ImageCandidatePicker 共享组件 Props 契约
 *
 * 真源：IMGH-P2-2B（SEQ-20260619-02 / ADR-208 D-208-2）· arch-reviewer (claude-opus-4-8, agentId a9732b79ad7128d4d) 设计
 * 姊妹件：image-lightbox.types.ts / image-compare.types.ts（同 feedback/ 族）
 *
 * 用途：多源补图候选缩略选图器。每个候选 = 缩略图 + source pill + confidence 标记(🟢高置信/🟡待确认)
 *   + 选中态 + 已应用标记 + 「加载更多」入口槽。空/加载/错误态复用 state 原语。
 *   首个消费方 = ImageGovernanceDrawer「① 从外部源候选选图」（server-next _client/，3A）。
 *
 * 依赖方向裁定（arch-reviewer 裁定 B-1）：
 *   - admin-ui 禁止 import server-next 的 ImageCandidate（依赖方向单向：server-next → admin-ui，不可反向成环）。
 *   - 本组件定义自己归属 admin-ui 的视图类型 ImageCandidateOption，结构与后端 ImageCandidate 对齐
 *     （同名子集字段 + 选中键），由消费方做一次 DTO → Option 的纯映射（结构同构，零信息损失）。
 *
 * 哑组件契约：
 *   - 不调 API；候选数组由消费方备好传入。选中态受控（selectedKey + onSelect）。
 *   - confidence 视觉分级下沉组件（isWinner → 🟢，否则 → 🟡），复用后端语义，不在组件硬编码置信阈值。
 *
 * 扩展边界（防未来误改）：
 *   (a) 候选键 key 由消费方计算并填入 option.key（建议 `${source}::${sourceRef ?? ''}`），
 *       本组件不假设键构成、不在内部拼键——避免未来 PK 规则变化时改契约。
 *   (b) confidence 数值(0–1) 仅作 tooltip/标注展示，不在组件内做阈值分级；高/低置信视觉仅由 isWinner 决定。
 *   (c) 缩略尺寸固定走内部一档；未来需多尺寸应加 thumbSize 枚举 prop，不得把 option 形状复杂化。
 *
 * 消费方（≥3）：
 *   1. ImageGovernanceDrawer 候选选图（本期）  2. 视频编辑 TabImages 候选补图（未来）  3. 批量补图预览（未来）
 *
 * §C 协同（3A 抽屉数据流，记入 3A 实装）：
 *   listImageCandidates → ImageCandidate[] →（消费方纯映射，key=`${source}::${sourceRef ?? ''}`）→ Option[]。
 *   onSelect(option) 后消费方据 option 既喂 ImageCompare 候选图、又（从持有的 Map<key,ImageCandidate> 反查 sourceRef）
 *   构造 apply-candidate 入参。**Option 不携带 sourceRef 裸字段** → 消费方须持 Map 取回 sourceRef（否则 CANDIDATE_STALE 409 无从校验）。
 */

import type { ReactNode } from 'react'

/**
 * 候选视图类型（归属 admin-ui，与后端 ImageCandidate 结构对齐的子集 + 选中键）。
 * 消费方从 ImageCandidate 纯映射而来；admin-ui 不反向 import server-next。
 */
export interface ImageCandidateOption {
  /**
   * 候选唯一键（消费方计算）。建议 `${source}::${sourceRef ?? ''}`。
   * 选中态比对、列表 React key 均用此值。
   */
  readonly key: string
  /** 缩略/原图 URL。 */
  readonly url: string
  /** 来源标识，如 'tmdb' / 'douban' / 'bangumi'（原样展示，枚举映射不下沉）。 */
  readonly source: string
  /** 置信度 0–1（可选，后端 confidence）；仅作标注/tooltip，不参与视觉分级阈值。 */
  readonly confidence?: number | null
  /** reconcile 逻辑 winner（后端 isWinner）；true → 🟢 高置信，false → 🟡 待确认。 */
  readonly isWinner: boolean
  /** 已 safeUpdate 落 media_catalog（后端 applied）；true → 「已应用」标记。 */
  readonly applied: boolean
  /** 来源副标题（可选，已格式化），如 'tmdb 9.1分 zh'；省略时仅展示 source。i18n 不下沉。 */
  readonly sourceLabel?: ReactNode
}

/** Picker 错误态（message + 可选 retry）。 */
export interface ImageCandidatePickerError {
  /** 已格式化错误文本（i18n 不下沉）。 */
  readonly message: string
  /** 重试回调（可选）；提供时 ErrorState 渲染重试按钮。 */
  readonly onRetry?: () => void
}

/**
 * ImageCandidatePicker Props — 多源候选缩略选图器
 */
export interface ImageCandidatePickerProps {
  /** 候选列表（消费方从 ImageCandidate[] 纯映射）。空数组 + loading=false → 渲染 EmptyState。 */
  readonly candidates: readonly ImageCandidateOption[]

  /** 当前选中候选键（受控）；null/undefined → 无选中。 */
  readonly selectedKey?: string | null

  /**
   * 选中回调。回传整个 option（含 key/url/source），供消费方既喂 ImageCompare 作候选图、
   * 又（从 Map<key,ImageCandidate> 反查 sourceRef）构造 apply-candidate 入参（见 §C）。
   * applied 候选默认仍可被选（用于"重新应用 / 对比"）；如需禁止重选，消费方在 onSelect 内自行拦。
   */
  readonly onSelect: (option: ImageCandidateOption) => void

  /** 加载态（默认 false）；true → 渲染 LoadingState（复用 state 原语，不另造 skeleton）。 */
  readonly loading?: boolean

  /** 错误信息（可选）；非空 → 渲染 ErrorState（复用 state 原语）。 */
  readonly error?: ImageCandidatePickerError

  /**
   * 「加载更多」入口槽（可选 slot 逃生口）。
   * 裁定 B-4：用 slot 而非 onLoadMore+hasMore —— "加载更多 TMDB 多图"是消费方专属业务（实时拉取 + 缓存策略），
   * 各消费方语义差异大，组件只提供放置位、不持有分页状态。
   */
  readonly loadMoreSlot?: ReactNode

  /**
   * source pill 渲染逃生口（可选）。
   * 省略 → 组件内置 Pill（variant='neutral'，children=sourceLabel ?? source）。
   * 提供 → 由消费方接管（如需注入来源图标 ReactNode；admin-ui 零图标库依赖，图标必由消费方注入）。
   */
  readonly renderSourcePill?: (option: ImageCandidateOption) => ReactNode

  /** 空态自定义文案（可选，已格式化）；省略走 EmptyState 内置默认。 */
  readonly emptyTitle?: ReactNode
  readonly emptyDescription?: ReactNode

  /** 高置信/待确认标记的 a11y 文本（可选，已格式化），如 { high: '高置信', low: '待确认' }。i18n 不下沉。 */
  readonly confidenceLabels?: { readonly high: string; readonly low: string }

  /** 已应用标记 a11y 文本（默认 '已应用'）。 */
  readonly appliedLabel?: ReactNode

  /** 测试钩子（落到容器 data-testid）。 */
  readonly testId?: string
}
