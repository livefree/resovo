/**
 * lines-panel.types.ts — LinesPanel 共享复合组件 Props 契约
 *
 * 真源：arch-reviewer (claude-opus-4-7) FIX-B API 设计（CHG-SN-7-MISC-MOD-PLAYER / SEQ-20260502-01）
 *
 * 消费方（2 个确认）：
 *   1. 审核台 PendingCenter → compact density / selectedKey + onLineSelect（FIX-D AdminPlayer 桥接）
 *   2. VideoEditDrawer TabLines → regular density / 无选中态
 *
 * 关键约束：
 *   - R2：不 import 任何 apps/server-next/** 类型；依赖方向单向（admin-ui → packages/types）
 *   - R3：EpisodeMini.sourceUrl + updatedAt 必填（FIX-D 切源 / 乐观锁 PRE-01-C 双需求）
 *   - R1：selectedKey 与 onLineSelect 严格同时出现或同时省略
 */

import type { DualSignalDisplayState, ResolutionTier } from '@resovo/types'

// ── 数据形 ─────────────────────────────────────────────────────────────

/** 单集最小信号信息（行展开后的集数级 mini grid + FIX-D AdminPlayer 切源） */
export interface EpisodeMini {
  readonly id: string                   // video_sources.id（per-episode 行 PK）
  readonly episodeNumber: number | null
  readonly probe: DualSignalDisplayState
  readonly render: DualSignalDisplayState
  readonly latencyMs: number | null
  readonly isActive: boolean
  readonly sourceUrl: string            // FIX-D AdminPlayer 切源直接读（R3 必填）
  readonly updatedAt: string            // 乐观锁 token（PRE-01-C / R3 必填）
}

/** 单条聚合后的"线路"（聚合键 = `${siteKey}|${lineName}`） */
export interface LineAggregate {
  readonly key: string                              // `${siteKey}|${lineName}`
  readonly siteKey: string                          // null → aggregate 负责 fallback 'unknown'
  readonly lineName: string
  readonly hostname: string | null                  // 从 source_url 解析，设计稿展示用
  readonly totalEpisodes: number
  readonly activeCount: number
  readonly probeAggregate: DualSignalDisplayState
  readonly renderAggregate: DualSignalDisplayState
  readonly latencyMedianMs: number | null
  readonly qualityHighest: ResolutionTier | null    // 复用 @resovo/types 真源（R5）
  readonly episodes: ReadonlyArray<EpisodeMini>     // 已按 episodeNumber asc 排序
}

// ── 聚合输入（aggregate.ts 专用） ──────────────────────────────────────

/**
 * 聚合函数输入行：admin-ui 内部 snake_case 最小集。
 * 不 import apps/** 或 lib/** 类型，保持 admin-ui 单向依赖（R2）。
 * 消费方将 ContentSourceRow / VideoSource 赋值给此接口无需额外 cast。
 */
export interface RawSourceRow {
  readonly id: string
  readonly source_site_key: string | null
  readonly source_name: string
  readonly source_url: string
  readonly episode_number: number | null
  readonly is_active: boolean
  readonly probe_status: string
  readonly render_status: string
  readonly latency_ms: number | null
  readonly updated_at: string
  readonly quality_detected?: string | null
  readonly hostname?: string | null
}

export interface GroupSourcesOptions {
  /** 自定义排序；默认：activeCount desc → probeAggregate → lineName asc */
  readonly sortLines?: (a: LineAggregate, b: LineAggregate) => number
}

// ── 组件 Props ─────────────────────────────────────────────────────────

export type LinesPanelDensity = 'compact' | 'regular' | 'comfortable'

export interface LinesPanelProps {
  readonly lines: ReadonlyArray<LineAggregate>
  /** 默认 'regular' */
  readonly density?: LinesPanelDensity

  /** 单集 toggle（per-episode 粒度；updatedAt 透传给乐观锁） */
  readonly onToggleEpisode: (args: {
    readonly lineKey: string
    readonly episodeId: string
    readonly nextActive: boolean
    readonly updatedAt: string
  }) => void | Promise<void>

  /** 整条线路批量 toggle（可选；不提供则隐藏行级批量按钮） */
  readonly onToggleLine?: (args: {
    readonly lineKey: string
    readonly nextActive: boolean
  }) => void | Promise<void>

  readonly onDisableDead: () => void | Promise<void>
  readonly onRefetch: () => void | Promise<void>
  readonly onHealthOpen: (args: { readonly lineKey: string; readonly episodeId: string }) => void

  // ── per-episode inline action callbacks（CHG-351-B / ADR-158）─────
  // 单 episode 行 inline 诊断动作：仅当对应 callback 提供时按钮显示
  // ADR-158 D-158-8 边界：仅诊断（不写 video_sources 状态）/ 状态写走 onToggleEpisode

  /** 单 episode 探测回调（ADR-158 POST /admin/sources/:id/probe / 仅当提供时渲染按钮） */
  readonly onProbeEpisode?: (args: { readonly lineKey: string; readonly episodeId: string }) => void | Promise<void>

  /** 单 episode 试播渲染检测回调（ADR-158 POST /admin/sources/:id/render-check / 仅当提供时渲染按钮） */
  readonly onRenderCheckEpisode?: (args: { readonly lineKey: string; readonly episodeId: string }) => void | Promise<void>

  /**
   * 受控选择（R1）：selectedKey + onLineSelect 必须同时出现或同时省略。
   * 省略 = 无选中态（VideoEditDrawer 用法）。
   * 出现 = 受控（审核台 + FIX-D AdminPlayer 桥接用法）。
   */
  readonly selectedKey?: string | null
  readonly onLineSelect?: (args: {
    readonly lineKey: string
    readonly line: LineAggregate
    readonly firstActiveUrl: string | null
  }) => void

  // ── per-episode pending state sets（CHG-351-B / ADR-158 / I2 防 race）──
  // 所有 set 互独立；EpisodeRow disabled 计算需 OR 防 toggle+probe 并发污染

  /** 进行中的 episodeId 集（消费方 hook 持有，含乐观锁回滚状态） */
  readonly toggling?: ReadonlySet<string>

  /** 进行中的 probe episodeId 集（ADR-158 /probe 按钮 disabled / 命名避免 React 'rendering' 语境歧义） */
  readonly probingEpisodeIds?: ReadonlySet<string>

  /** 进行中的 render-check episodeId 集（ADR-158 /render-check 按钮 disabled） */
  readonly renderCheckingEpisodeIds?: ReadonlySet<string>

  readonly loading?: boolean
  readonly error?: string | null
  readonly onErrorRetry?: () => void

  /** 动作错误（toggle/race 等），显示为 inline 红条，不替换主内容 */
  readonly actionError?: string | null

  readonly emptyText?: string
  readonly testId?: string
  readonly 'aria-label'?: string
}
