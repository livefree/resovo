# LinesPanel 共享组件提取设计草案（CHG-SN-4-FIX-B 治理升级）

> 版本：v0.1（草案 / 待敲定）
> 日期：2026-05-03
> 状态：⏸ 暂停执行 — 待播放线路页面（M-SN-5 合并/拆分 + 前台播放页）完成后返回敲定
> 决策权：用户（2026-05-03 21:xx 拍板"提取为共享组件 + 暂停 FIX-B 实装"）
> 父方案：`docs/designs/backend_design_v2.1/M-SN-4-moderation-console-plan.md` v1.6 §1 G2（线路面板信息密度修复）
> 序列：SEQ-20260502-01 阶段 2（FIX-B）

---

## 0. 暂停理由 + 范围调整

### 触发

CHG-SN-4-FIX-F 完成后，原 FIX-B 计划在 `apps/server-next/src/app/admin/moderation/_client/LinesPanel.tsx` 内重写为聚合视图 + 信息密度对齐。用户调研后判断：

> "线路面板在多处可用，内容审核三 tab，视频编辑，合并拆分等处都有可能使用。计划提取线路面板作为一个复用组件设计。"

### 实装现状（提取前）

两处独立实装（共 461 行业务 + 133 行 hook）：

| 维度 | 审核台 `LinesPanel.tsx`（247 行）| VideoEditDrawer `TabLines.tsx`（214 行）|
|---|---|---|
| 视图 | 列表行（紧凑） | 表格 grid 7 列 + 头部 BarSignal |
| State | 内联 useState | `useVideoSources` hook（lib/videos/use-sources.ts，133 行）|
| Fetch | `lib/moderation/api.ts::fetchVideoSources` | `lib/videos/api.ts::listVideoSources` |
| 视觉密度 | 36px 行（无选中态、无质量 chip） | 36px 行（表格 grid + 拖拽提示）|
| 行级展开 | 无（FIX-B 计划新增） | 无 |
| 共享原子 | DualSignal + LineHealthDrawer | + BarSignal |

**重复内容**：fetch / toggle / disableDead / refetch / openHealth / 状态机近乎逐字重复。

### 范围扩张

原 FIX-B（1d，moderation 模块内重写）→ 提取后约 2d：
- `packages/admin-ui` 新增 composite/lines-panel + cell/signal-chip
- 双消费方迁移（moderation/_client/LinesPanel + VideoEditDrawer/TabLines）
- 预留 M-SN-5 合并/拆分页第 3 消费方契约空间

### 暂停决策

待**播放线路页面（M-SN-5 合并/拆分 + 前台播放页）完成后**再返回敲定最终治理方案。理由：

1. M-SN-5 合并/拆分页面的实际交互需求未定型 — 提前下沉契约可能漏点
2. 前台播放页的"线路切换 / 选中线路 / feedback 上报"交互模式可能影响 admin 共享组件的 selectedKey / onLineSelect 契约
3. 第 3 消费方需求验证后契约稳定性更高 → arch-reviewer Opus 评审一次到位

---

## 1. 决策汇总（用户 2026-05-03 拍板）

| 编号 | 决策点 | 结论 |
|---|---|---|
| LP-01 | 共享组件位置 | **`packages/admin-ui/src/components/composite/lines-panel/`**（新建 composite 目录，预留 RightPaneTabs 等未来复合组件下沉）|
| LP-02 | 聚合工具函数位置 | 待敲定（候选：与组件同包 `composite/lines-panel/aggregate.ts` vs 独立 `packages/admin-ui/src/utils/`）|
| LP-03 | LineAggregate 字段命名 | **camelCase**（与 admin-ui 现有共享组件一致；消费方需把 snake_case `VideoSource` row 映射后传入）|
| LP-04 | density variant 范围 | **`'compact' \| 'regular' \| 'comfortable'`**（含 M-SN-5 合并/拆分页预留 comfortable 档）|
| LP-05 | 任务卡拆分方式 | 待敲定（候选：3 张串行卡 — FIX-B1 契约/FIX-B2 实装/FIX-B3 迁移 vs 单张大卡）|
| LP-06 | plan 版本同步 | 待敲定（候选：v1.7 patch 段记录决策 + 链接本草案 + 更新 D-14 下沉清单 5→7 件）|

---

## 2. 共享组件契约草案

### 2.1 数据层契约

```typescript
// packages/admin-ui/src/components/composite/lines-panel/lines-panel.types.ts

import type { DualSignalDisplayState } from '@resovo/types'

/**
 * 单条聚合后的"线路"（一条 line = (source_site_key, source_name) 复合键
 * 下所有集的聚合，由消费方在数据层完成 groupBy 后传入）。
 *
 * 字段命名采纳 camelCase（LP-03）；消费方需把 snake_case VideoSource row
 * 映射为本结构后传入。
 */
export interface LineAggregate {
  /** 复合键 = `${siteKey}|${lineName}`，组件用于行级 React key */
  readonly key: string
  readonly siteKey: string                // 站点 key（Z01 / Z02 / ...）
  readonly lineName: string               // 线路名（"线路1" / "线路2" / ...）
  readonly hostname: string | null        // 从 source_url 解析的域名（lzcaiji.com / yzy.cn / ...）
  readonly totalEpisodes: number          // 该线路下所有 video_sources 行数
  readonly activeCount: number            // is_active=true 的行数
  readonly probeAggregate: DualSignalDisplayState   // 该线路下所有集的 probe_status 聚合
  readonly renderAggregate: DualSignalDisplayState  // 同上 render_status
  readonly latencyMedianMs: number | null           // 活跃集中位数；NULL 显示 "—"
  readonly qualityHighest: string | null            // 最高档位（4K > 2K > 1080P > ...）
  readonly episodes: ReadonlyArray<EpisodeMini>     // 集数级展开数据（折叠时不渲染，展开时渲染 mini grid）
}

/** 单集的最小信号信息（用于行展开后的集数 mini grid）*/
export interface EpisodeMini {
  /** video_sources.id（行级唯一；用于 LineHealthDrawer 路由）*/
  readonly id: string
  readonly episodeNumber: number | null
  readonly probe: DualSignalDisplayState
  readonly render: DualSignalDisplayState
  readonly latencyMs: number | null
  readonly isActive: boolean
}
```

### 2.2 组件 Props 契约

```typescript
export interface LinesPanelProps {
  /** 已聚合的线路列表（消费方完成 groupBy + 状态聚合后传入）*/
  readonly lines: ReadonlyArray<LineAggregate>

  /**
   * 视觉密度变体（LP-04）
   * - 'compact'：32px 行（审核台 PendingCenter 默认）
   * - 'regular'：36px 行（VideoEditDrawer TabLines 默认）
   * - 'comfortable'：44px 行（M-SN-5 合并/拆分页预留）
   */
  readonly density?: 'compact' | 'regular' | 'comfortable'

  /** 当前选中线路 key；驱动行级 ● 指示点 + 高亮样式 */
  readonly selectedKey?: string | null

  /** 已展开的线路 key 集合（受控；消费方决定单展开 vs 多展开策略）*/
  readonly expandedKeys?: ReadonlySet<string>

  /** 加载态（首屏；后续 refetch 不应触发整体 loading）*/
  readonly loading?: boolean

  /** 错误态 + 重试回调 */
  readonly error?: { readonly message: string; readonly onRetry?: () => void } | null

  // ── 行级回调 ──────────────────────────────────────────────

  /** 点击行选中线路（供 Player 取源）*/
  readonly onLineSelect?: (line: LineAggregate) => void

  /** 切换行展开/折叠 */
  readonly onLineToggleExpand?: (line: LineAggregate) => void

  /** 禁用整条线路（批量 toggle 该线路所有 episode 的 is_active=false）*/
  readonly onLineDisable?: (line: LineAggregate) => void

  /** 集数 cell 点击 → 典型场景：打开 LineHealthDrawer 看该集事件 */
  readonly onEpisodeClick?: (line: LineAggregate, episode: EpisodeMini) => void

  // ── 头部 / 底部 slot ──────────────────────────────────────

  /** 头部标题；默认 "线路 {activeCount}/{total} 启用" */
  readonly title?: string

  /** 头部右侧按钮 slot；默认渲染"↻ 重新抓取"按钮（onRefetchAll）*/
  readonly headerActions?: React.ReactNode

  /** 默认头部按钮回调（headerActions 未传时启用）*/
  readonly onRefetchAll?: () => void

  /** 底部左侧 slot；默认渲染"📜 证据"按钮（触发 onEvidenceOpen）*/
  readonly footerLeft?: React.ReactNode

  /** 默认底部"证据"按钮回调（footerLeft 未传时启用；通常打开当前选中线路的 LineHealthDrawer）*/
  readonly onEvidenceOpen?: (line: LineAggregate) => void

  /** 底部右侧 slot；默认渲染"✕ 禁用全失效"按钮（onDisableAllDead）*/
  readonly footerRight?: React.ReactNode

  /** 默认底部"禁用全失效"按钮回调 */
  readonly onDisableAllDead?: () => void

  // ── a11y / testId ─────────────────────────────────────────

  readonly testId?: string
  readonly ariaLabel?: string
}
```

### 2.3 聚合工具函数（位置待 LP-02 敲定）

```typescript
// packages/admin-ui/src/components/composite/lines-panel/aggregate.ts
// 或 packages/admin-ui/src/utils/aggregate-sources.ts

/** 视频源原始行（消费方提供，可来自 fetchVideoSources / listVideoSources 任一端点）*/
export interface VideoSourceRowMinimal {
  readonly id: string
  readonly source_site_key: string | null
  readonly source_name: string
  readonly source_url: string
  readonly episode_number: number | null
  readonly probe_status: string
  readonly render_status: string
  readonly latency_ms: number | null
  readonly quality_detected: string | null
  readonly is_active: boolean
}

/**
 * 按 (source_site_key, source_name) 复合键聚合视频源行为线路列表。
 *
 * 聚合规则：
 *   - probeAggregate / renderAggregate：全 ok→ok / 部分 ok→partial / 全 dead→dead
 *     / 全 pending→pending / 其他→unknown
 *   - latencyMedianMs：仅活跃集中位数；无活跃集 → null
 *   - qualityHighest：4K > 2K > 1080P > 720P > 480P > 360P > 240P；无值 → null
 *   - hostname：从首条非空 source_url 解析（new URL(...).hostname）；解析失败 → null
 *   - episodes：原行映射为 EpisodeMini，按 episode_number 升序
 *
 * 消费方需把 fetchVideoSources/listVideoSources 返回的 row[]（snake_case）传入；
 * 返回 LineAggregate[]（camelCase）。
 */
export function aggregateSourcesByLine(
  sources: ReadonlyArray<VideoSourceRowMinimal>
): LineAggregate[]
```

---

## 3. SignalChip 子组件（同期下沉）

LinesPanel 的"探可达"/"渲未知"等文字 chip 形态信号呈现，与现有 `DualSignal`（圆点形态）不同，需新增独立组件。

### 3.1 位置 + 命名

`packages/admin-ui/src/components/cell/signal-chip.tsx`（cell 目录，与 BarSignal / DualSignal 并列）

### 3.2 Props 草案

```typescript
export type SignalKind = 'probe' | 'render'

export interface SignalChipProps {
  readonly kind: SignalKind
  readonly state: DualSignalDisplayState   // 'ok' | 'partial' | 'dead' | 'pending' | 'unknown'
  readonly size?: 'sm' | 'md'              // 默认 'sm'（10px font / 2-6 padding）
  readonly testId?: string
}
```

### 3.3 5 状态 × 2 类型 = 10 种文字 + 配色

| state | probe 文字 | render 文字 | bg / fg token |
|---|---|---|---|
| ok | 探可达 | 渲可达 | `--state-success-bg` / `--state-success-fg` |
| partial | 探部分 | 渲部分 | `--state-warning-bg` / `--state-warning-fg` |
| dead | 探失败 | 渲失败 | `--state-error-bg` / `--state-error-fg` |
| pending | 探待测 | 渲待测 | `--bg-surface-raised` / `--fg-muted` |
| unknown | 探未知 | 渲未知 | `--bg-surface-raised` / `--fg-muted` + opacity 0.6 |

零硬编码颜色（CI grep `#[0-9a-f]{3,6}` 命中数 = 0）。

---

## 4. 视觉规约（FIX-B 原始）

继承自 plan v1.6 §2 视觉密度规约（LinesPanel 单行 10 列 grid）：

```
┌─┬───────┬─────────────┬──────┬──────┬──────┬──────┬──┬──┐
│●│ 线路N │ domain.com  │ NNms │ 探chip │渲chip │ 720P │✕│▶│
└─┴───────┴─────────────┴──────┴──────┴──────┴──────┴──┴──┘
 12  56     1fr           48     56      56     40   24 24
```

- **● 当前选中指示点**：仅 `selectedKey === line.key` 行渲染；颜色 `var(--accent-default)`
- **选中行视觉态**：`bg: var(--admin-accent-soft)` + `border-left: 2px solid var(--accent-default)`
- **行间**：1px solid `var(--border-subtle)`，无 gap
- **展开行**（▶ → ▼）：padding-left 28px；集数级 mini grid 每 cell 56×24，复用现有 `DualSignal`（dot variant）；hover 显示 latency / 错误（title attribute）；点击 → `onEpisodeClick`
- **density 间距规则**：
  - compact：行 32px / chip padding 2px 6px / fontSize 10
  - regular：行 36px / chip padding 3px 7px / fontSize 11
  - comfortable：行 44px / chip padding 4px 8px / fontSize 12

参考截图：`docs/designs/screenshot/Screenshot 2026-05-02 at 20.15.54.png`

---

## 5. 消费方迁移路径（草案）

### 5.1 审核台 LinesPanel（apps/server-next/src/app/admin/moderation/_client/LinesPanel.tsx）

```typescript
'use client'

import { LinesPanel as SharedLinesPanel } from '@resovo/admin-ui'
import { aggregateSourcesByLine } from '@resovo/admin-ui'  // 或 utils 子路径
import * as api from '@/lib/moderation/api'
import { useState, useEffect } from 'react'

export function LinesPanel({ videoId, selectedKey, onLineSelect }: Props) {
  const [sources, setSources] = useState<ContentSourceRow[]>([])
  const [loading, setLoading] = useState(true)
  // ... fetch + state 管理（不变）

  const lines = useMemo(() => aggregateSourcesByLine(sources), [sources])

  return (
    <SharedLinesPanel
      lines={lines}
      density="compact"
      selectedKey={selectedKey}
      loading={loading}
      onLineSelect={onLineSelect}
      onLineDisable={(line) => api.disableLine(videoId, line.key)}
      onLineToggleExpand={(line) => /* 展开 state 管理 */}
      onEpisodeClick={(line, ep) => /* 打开 LineHealthDrawer */}
      onRefetchAll={() => api.refetchSources(videoId)}
      onDisableAllDead={() => api.disableDeadSources(videoId)}
    />
  )
}
```

业务文件从 247 行 → 估算 ~80 行（净减 ~170 行）。

### 5.2 VideoEditDrawer TabLines（apps/server-next/src/app/admin/videos/_client/_videoEdit/TabLines.tsx）

```typescript
'use client'

import { LinesPanel as SharedLinesPanel } from '@resovo/admin-ui'
import { useVideoSources } from '@/lib/videos/use-sources'
import { aggregateSourcesByLine } from '@resovo/admin-ui'

export function TabLines({ videoId }: TabLinesProps) {
  const [state, actions] = useVideoSources(videoId)
  const lines = useMemo(() => aggregateSourcesByLine(state.sources), [state.sources])

  return (
    <SharedLinesPanel
      lines={lines}
      density="regular"
      loading={state.loading && state.sources.length === 0}
      error={state.error ? { message: VE.lines.errors.loadFailed, onRetry: actions.reload } : null}
      onLineDisable={(line) => /* 批量 toggle 该线路所有 episode */}
      onEpisodeClick={(line, ep) => actions.openHealth(ep.id)}
      onRefetchAll={() => actions.refetch()}
      onDisableAllDead={() => actions.disableDead()}
    />
  )
}
```

业务文件从 214 行 → 估算 ~80 行（净减 ~130 行）。

### 5.3 M-SN-5 合并/拆分页（预留契约空间）

- density="comfortable"
- footerRight slot 注入"合并选中线路"按钮（多选场景）
- expandedKeys 管理多选展开
- 不在本卡范围；契约预留即可

---

## 6. 任务卡拆分（待 LP-05 敲定）

候选 A — **3 张串行卡**（推荐）：

| 卡号 | 范围 | 工时 | 强制子代理 |
|---|---|---|---|
| FIX-B1 | LinesPanel + SignalChip + LineAggregate Props 契约起草 + ADR-111 草案 + arch-reviewer Opus 评审契约 | 0.5d | ✅ arch-reviewer (opus) |
| FIX-B2 | admin-ui composite/lines-panel + cell/signal-chip 实装 + aggregateSourcesByLine util + ≥ 30 case 单测 + visual baseline 5 张 | 1d | — |
| FIX-B3 | 消费方迁移：审核台 LinesPanel.tsx 替换 + VideoEditDrawer TabLines.tsx 替换 + 删两处旧实装 + e2e 回归 | 0.5d | — |

候选 B — **单张大卡 FIX-B**（评审/实装/迁移合一）。

---

## 7. 风险与注意事项

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| **第 3 消费方需求未定型 → 契约返工** | 中 | 中 | 暂停决策（本草案）— 待 M-SN-5 + 前台播放页需求落地后再敲定 |
| **aggregateSourcesByLine 跨站点合并语义模糊** | 中 | 高 | 严格按 `(source_site_key, source_name)` 复合键聚合（plan v1.6 §3 方案 B）；DEBT-LINE-KEY-01 推迟 line_key 一级建模到 M-SN-5 |
| **density variant 实装不一致** | 低 | 中 | CSS module + 命名约定 `.density-compact / .density-regular / .density-comfortable`；单测覆盖三档行高断言 |
| **旧 LinesPanel + TabLines 业务编排逻辑漏迁移** | 中 | 高 | 迁移卡（FIX-B3）必须做 e2e 黄金路径回归；VideoEditDrawer 拖拽提示等 admin-only 行为需 slot 注入 |
| **共享组件跨子项目消费 → server v1（已冻结）受影响** | 低 | 低 | apps/server v1 不引用 admin-ui composite 目录（grep 守门）|

---

## 8. 暂停期间观察清单

待以下事件之一落地后返回敲定：

1. **M-SN-5 合并/拆分页面规划落地**（D-15 推迟卡转入实装）
2. **前台播放页线路切换需求定型**（特别是 selectedKey / onLineSelect 是否需要扩展为多线路同时显示等）
3. **DEBT-LINE-KEY-01 决策** —— 是否在本提取期一并落地 line_key 一级概念（涉及 schema 迁移）

观察期内：
- LinesPanel.tsx (审核台) 保持现状（FIX-B 暂停 → 当前实装"按 video_sources 行平铺，10 集 × 3 站 = 30 行" + 视觉密度未对齐设计稿）
- TabLines.tsx (VideoEditDrawer) 保持现状（CHG-SN-4-08 完成态）
- 设计稿 `Screenshot 2026-05-02 at 20.15.54.png` 视觉密度暂未达成（FIX-CLOSE 收口卡需登记此偏离）

---

## 9. 修订日志

### v0.1 — 2026-05-03（草案首版）

**性质**：FIX-B 治理升级 — 由 moderation 模块内重写改为 admin-ui 共享组件提取；用户判定暂停执行待 M-SN-5 / 前台播放页落地后敲定。

**决策来源**：用户 2026-05-03 21:xx 拍板：
- LP-01 共享组件位置 = (a) `packages/admin-ui/src/components/composite/lines-panel/`
- LP-03 LineAggregate 字段命名 = camelCase（采纳建议）
- LP-04 density variant 范围 = (b) `'compact' | 'regular' | 'comfortable'` 三档
- LP-02 / LP-05 / LP-06 待敲定

**修订项**：
1. 新建本草案文档
2. plan v1.6 → v1.7 patch（待 LP-06 敲定）— 暂未追加 plan
3. task-queue.md 序列 SEQ-20260502-01 中 FIX-B 状态 ⬜ → ⏸ 暂停（引用本草案）

**人工 sign-off**：用户 2026-05-03。

**arch-reviewer 评审**：本草案为 deferred 决策，不进 ADR；待 LP-05 任务卡启动时（FIX-B1）再走 arch-reviewer (claude-opus-4-7) 强制评审契约。
