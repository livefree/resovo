# CHG-SN-4-04 · admin-ui 共享组件下沉 5 件 — 开发指导方案

> status: active
> revision: v1.1（2026-05-02 审核闭环）
> owner: @engineering
> scope: M-SN-4 moderation console admin-ui shared components
> source_of_truth: yes（本卡执行真源）
> supersedes: none
> superseded_by: none
> parent_plan: `docs/designs/backend_design_v2.1/M-SN-4-moderation-console-plan.md` v1.4 + v1.5 patch
> task_id: CHG-SN-4-03 → **CHG-SN-4-04**（前置已 PASS 2026-05-01）
> 建议主循环：`claude-sonnet-4-6`
> 强制子代理：`arch-reviewer (claude-opus-4-7)` — Props 契约 + DecisionCard 跨层下沉例外
> last_reviewed: 2026-05-02

## v1.1 修订摘要（2026-05-02 审核闭环）

针对审核结论 3 项修正项（非阻塞）：

1. **§3.2 design-tokens 路径**：`packages/design-tokens/src/admin-layout.ts` → `packages/design-tokens/src/admin-layout/`（实测为目录，含 density.ts / shell.ts / surfaces.ts / table.ts / z-index.ts / index.ts）
2. **§6 视觉验收**：vitest snapshot 仅作结构基线；视觉基线明确为 **Playwright 截图对比**（@playwright/test `toHaveScreenshot()`）；snapshot 不能替代 visual diff
3. **§8 commit trailer**：改用 `docs/rules/git-rules.md` §M-SN 扩展协议（`Refs:` / `Plan:` / `Review:` / `Executed-By-Model:` / `Subagents:`）

---

## 1. 范围与依赖

### 1.1 D-14 下沉清单（plan v1.4 §1 决策表）

| # | 组件 | 来源 | 目标 | 复用矩阵依据 |
|---|------|------|------|-------------|
| 1 | `BarSignal` | 新建 | `packages/admin-ui/src/components/cell/` | plan §3 复用矩阵明列 "M-SN-4 下沉" |
| 2 | `LineHealthDrawer` | 新建 | `packages/admin-ui/src/components/feedback/` | plan §3 复用矩阵明列 "M-SN-4 下沉" |
| 3 | `RejectModal` | 新建 | `packages/admin-ui/src/components/feedback/` | M-SN-4 内部 3+ 处复用（plan §5.1/§5.3 + VideoEditDrawer） |
| 4 | `StaffNoteBar` | 新建 | `packages/admin-ui/src/components/feedback/` | M-SN-4 内部 2 处复用（DecisionCard + LinesPanel） |
| 5 | `DecisionCard` | `apps/server-next/src/app/admin/moderation/_client/DecisionCard.tsx` 上移 | `packages/admin-ui/src/components/cell/` | **跨层例外**（admin 子项目"2 处规则" + ADR-106 登记） |

### 1.2 前置依赖

- ✅ CHG-SN-4-03 PASS：`packages/types/src/admin-moderation.types.ts`（含 `DualSignalState` / `DualSignalDisplayState` / `ReviewLabel` / `SourceHealthEvent` / `VideoQueueRow`）
- ✅ admin-ui 既有原语：`Drawer` / `Modal`（`packages/admin-ui/src/components/overlay/`）/ `Spark` / `Pill` / `DualSignal`（`packages/admin-ui/src/components/cell/`）

### 1.3 packages/admin-ui 不变约束（必须遵守）

来自 `packages/admin-ui/src/index.ts` 顶部 docblock + ADR-103a §4.4：

1. **零 BrandProvider / ThemeProvider 声明**（Provider 不下沉，下游消费方注入）
2. **零图标库依赖**（lucide-react 等不允许 import；ReactNode 由 `apps/server-next` 注入到 `icon?: React.ReactNode` props）
3. **Edge Runtime 兼容**（模块顶层零 fetch / cookie / localStorage；hooks 内访问须 typeof window check）
4. **颜色 / 间距 / 阴影只读 `packages/design-tokens`**（CSS 变量；零硬编码 hex）

---

## 2. 组件 Props 契约草案（arch-reviewer 评审重点）

> Props 契约最终版以 arch-reviewer Opus 评审结论为准；以下为提交评审的初稿。

### 2.1 `BarSignal`（双信号双柱图）

**定位**：probe（Level 1 探测）+ render（Level 2 渲染验证）双柱并排，颜色由 `DualSignalDisplayState` 决定。

```typescript
// packages/admin-ui/src/components/cell/bar-signal.types.ts
import type { DualSignalDisplayState } from '@resovo/types'

export interface BarSignalProps {
  /** Level 1 probe 状态 */
  probeState: DualSignalDisplayState
  /** Level 2 render 状态 */
  renderState: DualSignalDisplayState
  /** 尺寸预设；默认 'md'（与 cell/spark 对齐）*/
  size?: 'sm' | 'md'
  /** a11y label；默认 'probe/render 健康指示' */
  ariaLabel?: string
  /** 点击触发 LineHealthDrawer 等场景；可选 */
  onClick?: () => void
}
```

**实装要点**：
- 单一 SVG，两条柱并排；颜色映射表来自 design-tokens（绑定 `--admin-status-{ok,warning,danger,unknown}`）
- 不接 i18n（纯视觉，文字由 `ariaLabel` 注入）
- forwardRef 转发到根 `<button>` / `<span>`（`onClick` 存在 → button；否则 span）

### 2.2 `LineHealthDrawer`（证据抽屉）

**定位**：单条线路的 health events 历史 + 当前状态聚合，复用 `Drawer` 原语包壳。

```typescript
// packages/admin-ui/src/components/feedback/line-health-drawer.types.ts
import type { SourceHealthEvent, DualSignalDisplayState } from '@resovo/types'

export interface LineHealthDrawerProps {
  open: boolean
  onClose: () => void
  /** 线路标题（site_name + line label） */
  title: string
  /** 当前聚合状态 */
  probeState: DualSignalDisplayState
  renderState: DualSignalDisplayState
  /** events 列表；空数组 → Empty state */
  events: SourceHealthEvent[]
  /** 加载中（events 还在拉取） */
  loading?: boolean
  /** 错误态 */
  error?: { message: string; onRetry?: () => void } | null
  /** 分页信息（可选）；不传则不显示分页 */
  pagination?: { page: number; total: number; onPageChange: (page: number) => void }
  /** ✅ 不下沉 i18n；文案 slot */
  emptyText?: string
  loadingText?: string
}
```

**实装要点**：
- 包壳 `Drawer`（admin-ui 原语）；侧边滑出
- events 渲染：时间线（created_at desc）；每条 origin / http_code / latency_ms / error_detail（折叠/展开）
- Empty / Loading / Error 复用 `state` 原语（admin-ui 已有）

### 2.3 `RejectModal`（预设标签 + 附言）

**定位**：拒绝操作 Modal，预设标签单选 + 附言 textarea，复用 `Modal` 原语包壳。

```typescript
// packages/admin-ui/src/components/feedback/reject-modal.types.ts
import type { ReviewLabel } from '@resovo/types'

export interface RejectModalProps {
  open: boolean
  onClose: () => void
  /** 标签列表；按 display_order 已排好序 */
  labels: ReviewLabel[]
  /** 默认选中的 labelKey；可选 */
  defaultLabelKey?: string
  /** 提交回调；resolve 后才关闭 Modal（消费方控制 close） */
  onSubmit: (payload: { labelKey: string; reason?: string }) => Promise<void>
  /** 提交中（外部状态注入） */
  submitting?: boolean
  /** 文案 slot（不下沉 i18n） */
  title?: string                  // 默认 '拒绝该视频'
  reasonPlaceholder?: string      // 默认 '附加说明（可选，最长 500 字）'
  submitLabel?: string            // 默认 '确认拒绝'
  cancelLabel?: string            // 默认 '取消'
}
```

**实装要点**：
- 标签单选用 radio group；reason 长度 ≤ 500（前端守门 + 计数器）
- 提交：`onSubmit({ labelKey, reason })` → Promise；resolve 由消费方 `onClose()` 关闭
- a11y：focus trap + Esc 关闭（继承 `Modal` 原语）

### 2.4 `StaffNoteBar`（amber 备注信息条）

**定位**：视频已有 staff_note 时的视觉提示条，可编辑（点击进入 inline edit）。

```typescript
// packages/admin-ui/src/components/feedback/staff-note-bar.types.ts
export interface StaffNoteBarProps {
  /** 当前 note；null/empty → 不渲染（消费方控制是否挂载） */
  note: string | null | undefined
  /** 进入编辑态回调；不传则 readonly */
  onEdit?: () => void
  /** 编辑中（外部 state） */
  editing?: boolean
  /** 编辑提交（editing=true 时接管 textarea） */
  onSubmit?: (note: string | null) => Promise<void>
  /** 文案 slot */
  emptyHint?: string              // 编辑态空值提示
  editLabel?: string              // 默认 '编辑'
  saveLabel?: string              // 默认 '保存'
  cancelLabel?: string            // 默认 '取消'
}
```

**实装要点**：
- 颜色绑定 design-tokens 新增 `--admin-staff-note-{bg,fg,border}`（amber 系；如已有则复用）
- 两态：display（点 onEdit 进入 edit）+ edit（textarea + 保存/取消）
- onSubmit 可清空（传 null）

### 2.5 `DecisionCard`（上移 + 跨层例外）

**定位**：moderation 右栏 / VideoEditDrawer 共用，承载 BarSignal + StaffNoteBar + 操作按钮组。

```typescript
// packages/admin-ui/src/components/cell/decision-card.types.ts
import type { DualSignalDisplayState, VideoQueueRow } from '@resovo/types'

export interface DecisionCardProps {
  /** 视频核心字段（由消费方裁剪传入） */
  video: Pick<VideoQueueRow, 'id' | 'title' | 'review_status' | 'visibility_status'
                            | 'is_published' | 'staff_note' | 'review_label_key'
                            | 'source_check_status' | 'douban_status'>
  /** 线路聚合双信号 */
  probeState: DualSignalDisplayState
  renderState: DualSignalDisplayState
  /** 操作按钮 slot；ReactNode 由消费方组合（含图标注入）*/
  actions?: React.ReactNode
  /** staff_note 编辑回调；不传 → readonly */
  onStaffNoteEdit?: () => void
  /** 点击 BarSignal 回调（打开 LineHealthDrawer） */
  onSignalClick?: () => void
}
```

**ADR-106 例外登记要点**（评审重点）：
- 跨应用层下沉（business `apps/server-next` ↔ shared `packages/admin-ui`）
- Props 契约严格基于 `packages/types`，不允许业务概念泄漏（如不允许传 `onApprove` / `onReject` 这类业务动作 → 必须经 `actions` slot 由消费方组合）
- 评审通过后 ADR-106 由"草案"转"正式 ADR"

---

## 3. 文件清单（写）

### 3.1 packages/admin-ui

```
packages/admin-ui/src/components/cell/
├── bar-signal.tsx                       # 新建
├── bar-signal.types.ts                  # 新建
├── decision-card.tsx                    # 新建（_client 上移）
├── decision-card.types.ts               # 新建
└── index.ts                             # 追加 export

packages/admin-ui/src/components/feedback/  # 新建子目录
├── line-health-drawer.tsx               # 新建
├── line-health-drawer.types.ts          # 新建
├── reject-modal.tsx                     # 新建
├── reject-modal.types.ts                # 新建
├── staff-note-bar.tsx                   # 新建
├── staff-note-bar.types.ts              # 新建
└── index.ts                             # 新建（4 件 + 类型 re-export）

packages/admin-ui/src/index.ts           # 追加 export feedback/
```

### 3.2 packages/design-tokens（按需）

仅当 amber staff-note 颜色 token 缺失时新增；优先复用 `--admin-status-warning-*`。

```
packages/design-tokens/src/admin-layout/  # 实测为目录，含 density.ts / shell.ts / surfaces.ts / table.ts / z-index.ts / index.ts
                                          # 如需补 --admin-staff-note-* 系：选择语义最贴近的子文件追加（建议 surfaces.ts）
```

### 3.3 apps/server-next 清理

```
apps/server-next/src/app/admin/moderation/_client/DecisionCard.tsx  # 删除
apps/server-next/src/app/admin/moderation/_client/ModerationConsole.tsx  # import 切换
apps/server-next/src/app/admin/moderation/_client/PendingCenter.tsx       # 同上
apps/server-next/src/app/admin/moderation/_client/StagingTabContent.tsx   # 同上
apps/server-next/src/app/admin/moderation/_client/RejectedTabContent.tsx  # 同上
```

> **重要**：本卡仅完成"组件搬迁 + import 切换"；接线（真实 props 传入 / 业务回调注入）属 CHG-SN-4-07 范围，本卡不动 mock-data 流转。

### 3.4 测试

```
tests/unit/components/admin-ui/cell/bar-signal.test.tsx           # ≥ 19 case
tests/unit/components/admin-ui/cell/decision-card.test.tsx        # ≥ 19 case
tests/unit/components/admin-ui/feedback/line-health-drawer.test.tsx  # ≥ 19 case
tests/unit/components/admin-ui/feedback/reject-modal.test.tsx     # ≥ 19 case
tests/unit/components/admin-ui/feedback/staff-note-bar.test.tsx   # ≥ 19 case
```

每组件 19 case 覆盖维度（与 SplitPane 卡对齐）：基础渲染 / props 变体 / a11y / 键盘 / 边界值 / 错误态 / forwardRef / className / data-* / 受控行为。

### 3.5 ADR

```
docs/decisions.md  # ADR-106 草案 → 正式（DecisionCard 跨层下沉例外）
```

---

## 4. 实装步骤（建议顺序）

| Step | 内容 | 依赖 |
|------|------|------|
| 1 | 起 5 件 `*.types.ts`（Props 契约草案）→ 提交 arch-reviewer Opus 预审契约 | packages/types ✅ |
| 2 | Opus 评审 PASS / CONDITIONAL ≤ 3 轮闭环 → 契约冻结 | Step 1 |
| 3 | 实装 `BarSignal` + 单测 19 case | Step 2 |
| 4 | 实装 `StaffNoteBar` + 单测 19 case | Step 2 |
| 5 | 实装 `LineHealthDrawer`（包壳 Drawer）+ 单测 19 case | Step 2，admin-ui Drawer ✅ |
| 6 | 实装 `RejectModal`（包壳 Modal）+ 单测 19 case | Step 2，admin-ui Modal ✅ |
| 7 | `DecisionCard` 上移：先 copy → 调整 import 切公共 props 契约 → 单测 19 case | Step 3+4（依赖 BarSignal/StaffNoteBar） |
| 8 | apps/server-next 5 处 import 切换 + 删除 _client/DecisionCard.tsx | Step 7 |
| 9 | ADR-106 草案 → 正式 ADR（评审记录追加） | Step 2 |
| 10 | 全量回归：typecheck + lint + unit + visual diff baseline 5 张 | Step 1–9 |

---

## 5. arch-reviewer Opus 评审重点（强制子代理）

按 plan §8.4 + ADR-106 例外协议，提交评审时附以下 6 项审议清单：

1. **5 件 Props 契约最小化原则**：是否存在业务概念泄漏（业务动作硬编码 → 必须 slot 化）
2. **DecisionCard 跨层下沉例外**：(a) 应用层规则覆盖度 (b) 跨层依据完备性 (c) ADR-106 登记完整度
3. **零图标库依赖一致性**：5 件 Props 是否全部走 ReactNode 注入（grep `from 'lucide-react'` 应 0 命中）
4. **Edge Runtime 兼容**：5 件代码顶层是否零 `fetch` / `localStorage` / `cookie`
5. **设计 token 引用完整性**：颜色 / 间距 / 阴影是否全部走 CSS 变量（grep `#[0-9a-fA-F]{3,8}` 0 命中）
6. **ReviewLabel / SourceHealthEvent / VideoQueueRow 消费稳定性**：是否仅消费 `packages/types` 已导出字段，无 ad hoc 类型扩展

**评级口径**：PASS（直接闭环）/ CONDITIONAL PASS（≤ 3 项修订迭代 ≤ 3 轮）/ REJECT（BLOCKER 写 task-queue.md 尾部）

---

## 6. 完成判据（must）

- [ ] typecheck 0 error / lint 0 warning
- [x] unit ≥ 19 case/组件 = ≥ 95 case 全绿（Vitest；DOM 结构断言）— 实际 116 case
- [ ] ~~visual diff baseline 5 张：Playwright `toHaveScreenshot()`~~ → **延后为 DEBT-SN-4-A 欠账**（截止 CHG-SN-4-10 milestone 收口）
  - 现状：仓库 `tests/visual/` 当前为手动 PNG 设计稿归档，无 Playwright `toHaveScreenshot()` 流水线（无 storybook / playground host）
  - 决策（2026-05-02）：本卡内不引入新 visual harness 基础设施（超出 D-14 5 件下沉范围）；登记欠账，由 -10 收口或独立 visual harness 卡统一处理
  - 已落地的视觉守门：116 unit case 含完整 DOM 结构 + token 引用 grep 守门；可作为像素对比之外的等效约束
- [ ] arch-reviewer Opus PASS / CONDITIONAL ≤ 3 轮闭环
- [ ] grep 守门：
  - `grep -r "from 'lucide-react'" packages/admin-ui/src/components/{cell,feedback}/` 0 命中（已存在的 server v1 mocks 例外）
  - `grep -rE "#[0-9a-fA-F]{3,8}" packages/admin-ui/src/components/{cell,feedback}/` 0 命中
- [ ] apps/server-next 5 处 import 切换后 `next build` 0 error
- [ ] ADR-106 草案 → 正式（评审记录附在 ADR 内）
- [ ] commit trailer 遵循 git-rules.md §M-SN 扩展协议：`Refs:` / `Plan:` / `Review:` / `Executed-By-Model:` / `Subagents: arch-reviewer (claude-opus-4-7)`

---

## 7. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| arch-reviewer Opus 评审 ≥ 4 轮迭代（M-SN-3 有先例） | 中 | 中 | Step 1 起 types 文件就提交评审；契约冻结才开始实装 |
| DecisionCard 跨层例外被驳回 → 改为业务层 wrapper | 低 | 中 | ADR-106 草案 + plan v1.4 §1 决策表已为 "本期下沉为例外"；保留 wrapper 兜底分支 |
| apps/server-next mock-data 类型与新 Props 不兼容 | 低 | 低 | mock-data 不动；Step 8 仅切 import；类型差异由 -07 接线时处理 |
| amber staff-note 颜色 token 缺失 | 低 | 低 | 优先复用 `--admin-status-warning-*`；如需新增走 design-tokens 卡（非本卡范围；记 follow-up） |

---

## 8. commit trailer 模板

遵循 `docs/rules/git-rules.md` §M-SN 扩展协议：

```
feat(CHG-SN-4-04): admin-ui 共享组件下沉 5 件（D-14）

Refs: CHG-SN-4-04
Plan: docs/designs/backend_design_v2.1/M-SN-4-04-admin-ui-shared-components-plan_20260502.md v1.1
Review: <arch-reviewer commit hash> PASS
Executed-By-Model: claude-sonnet-4-6
Subagents: arch-reviewer (claude-opus-4-7)
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

> ADR-106 由 ADR 自身 commit 落地；arch-reviewer 评审 commit hash 在 `Review:` 字段填入。

---

## 9. 与下游卡的契约边界

| 下游卡 | 消费方式 | 本卡保证 |
|--------|---------|---------|
| CHG-SN-4-07 审核台前端 | import 5 件 + 注入业务 actions / handlers | Props 契约稳定（评审冻结后不破坏性变更） |
| CHG-SN-4-08 VideoEditDrawer | import `DecisionCard` + `RejectModal` | 跨场景复用契约稳定 |

如本卡评审/实装期间发现契约必须修改：触发 BLOCKER 写入 `docs/task-queue.md` 尾部；不允许"边走边改"。
