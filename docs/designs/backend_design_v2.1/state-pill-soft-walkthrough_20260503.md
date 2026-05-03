# State Pill alpha-soft 切换走查清单

> status: active
> owner: @engineering
> scope: CHG-UI-04 完成时强制走查；CHG-UI-06 视觉走查复核入口
> source_of_truth: yes
> last_reviewed: 2026-05-03

---

## 切换概要

| 维度 | 旧（CHG-UI-04 之前） | 新（本卡落地后） |
|---|---|---|
| dark `--state-*-bg` | `oklch(<dark> ...)` 实色暗底 | `color-mix(in oklch, <base> 14%, transparent)` 软底 |
| dark `--state-*-fg` | `oklch(<light> ...)` 浅色文字 | `oklch(<base> ...)` 鲜亮文字 |
| light `--state-*-bg` | `oklch(<light> ...)` 浅色实底 | `color-mix(in oklch, <base> 14%, transparent)` 软底 |
| light `--state-*-fg` | `oklch(<dark> ...)` 深色文字 | `oklch(<base> ...)` 鲜亮文字 |
| `--state-*-border` | `<base>` 鲜亮 | `<base>` 鲜亮（**不变**，保留给显式边框消费方） |

设计意图：`fg = base 鲜亮文字色 + bg = 14% alpha 透底`，dark/light 共用同一映射。叠加后：
- dark surface (`oklch(11.2%)`) + 14% alpha success bg → 暗绿调底；fg `oklch(62%)` 鲜亮绿仍可读
- light surface (`oklch(100%)`) + 14% alpha success bg → 浅绿调底；fg `oklch(62%)` 鲜亮绿仍可读

---

## 消费组件走查清单（≥ 8 项）

每项核对：
1. dark / light 双主题视觉是否符合设计稿
2. fg/bg 对比度是否 ≥ AA（4.5:1 正文）
3. border（如有）是否仍可见

| # | 组件 | 文件:行 | 引用 token | 视觉变化预期 | 复核状态 |
|---|---|---|---|---|---|
| 1 | **Pill** (`variant=ok/warn/danger/info`) | `packages/admin-ui/src/components/cell/pill.tsx:51-54` | `--state-*-bg` + `--state-*-fg` | 由 Material 风（实色块+浅文字）变为设计风（软底+鲜亮 dot+鲜亮文字）；视觉差最显著 | 待复核 |
| 2 | **KpiCard** `is-ok / is-warn / is-danger` | `packages/admin-ui/src/components/cell/kpi-card.tsx:115-117, 124-126` | `--state-*-border` + `--state-*-fg` | border 不变（仍 base 鲜亮色边框）；value 文本染色不变（仍 base） | 待复核 |
| 3 | **KpiCard delta direction up/down** | `packages/admin-ui/src/components/cell/kpi-card.tsx:133-134` | `--state-success-fg` / `--state-error-fg` | delta 文本由 light 浅色变为 base 鲜亮色；可读性提升 | 待复核 |
| 4 | **DiffPanel 警告条** | `apps/server/src/components/admin/design-tokens/DiffPanel.tsx:88` | `--state-warning-{bg,fg,border}` | 由实色浅黄底+深黄字 → 透底浅黄+鲜亮黄字+鲜亮边框；密度感降低 | 待复核（apps/server v1 冻结期，仅维护期） |
| 5 | **DiffPanel added/removed 标签** | `apps/server/src/components/admin/design-tokens/DiffPanel.tsx:115-117` | `--state-success-fg` / `--state-error-fg` | 文本由 light 变 base，更鲜艳 | 待复核 |
| 6 | **InheritanceBadge** | `apps/server/src/components/admin/design-tokens/InheritanceBadge.tsx:18` | `--state-warning-{bg,border}` | bg 透底 + border 鲜亮黄；与 fg-default 文字组合时反差强 | 待复核 |
| 7 | **selection-action-bar** 删除按钮 | `packages/admin-ui/src/components/data-table/selection-action-bar.tsx:83, 130` | `--state-error-{fg,border}` + `bg = state-error-fg` | line 130 用 `state-error-fg` 当 bg：现 fg 是 base 鲜亮红 → 按钮底色更鲜艳；line 83 透底 hover | 待复核 |
| 8 | **views-menu** 默认视图选中态 | `packages/admin-ui/src/components/data-table/views-menu.tsx:103-104, 120` | `--state-info-{fg,bg}` | 由实色蓝底 → 透底蓝；文字由浅蓝 → 鲜亮蓝；选中辨识度提升 | 待复核 |
| 9 | **DataTable 错误态** | `packages/admin-ui/src/components/data-table/data-table.tsx:477` | `--state-error-fg` | 错误文字由 light 红 → 鲜亮 base 红；空状态可读性提升 | 待复核 |
| 10 | **TokenTable** | `apps/server/src/components/admin/design-tokens/TokenTable.tsx:84` | `--state-error-fg` | 同 #9 | 待复核（v1 冻结） |
| 11 | **dashboard sparkColor** | `apps/server-next/src/lib/dashboard-data.ts:110, 115, 120, 243, 247` | `--state-{warning,success,error,info}-fg` | sparkline 颜色由 light 变 base 鲜亮；折线对比度提升 | 待复核 |
| 12 | **VisChip / DecisionCard / RejectModal**（如使用 Pill） | 间接引用（通过 Pill）| 同 #1 | 同 Pill | 待复核 |

---

## 双主题可读性预估

`oklch(<base>)` 鲜亮文字色与各表面层组合的近似 contrast：

### Dark 模式

| Surface | success fg `oklch(62% .165 155)` | warning fg `oklch(74% .16 85)` | error fg `oklch(62% .195 25)` | info fg `oklch(66% .145 250)` |
|---|---|---|---|---|
| canvas (6.5%) | ✅ 高对比 | ✅ 高对比 | ✅ 高对比 | ✅ 高对比 |
| surface (11.2%) | ✅ 高对比 | ✅ 高对比 | ✅ 高对比 | ✅ 高对比 |
| surface-raised (13.5%) | ✅ 高对比 | ✅ 高对比 | ✅ 高对比 | ✅ 高对比 |
| surface-row (16.5%) | ✅ 高对比 | ✅ 高对比 | ✅ 高对比 | ✅ 高对比 |
| surface-elevated (23%) | ✅ 高对比 | ✅ 高对比 | ✅ 高对比 | ✅ 高对比 |

### Light 模式

| Surface | success fg `oklch(62% .165 155)` | warning fg `oklch(74% .16 85)` | error fg `oklch(62% .195 25)` | info fg `oklch(66% .145 250)` |
|---|---|---|---|---|
| canvas (96.8%) | ⚠️ warning 浅黄字易模糊 → 需走查复核 | 同左 | ✅ | ⚠️ info 鲜亮蓝在白底足够 |
| surface (100%) | ⚠️ 同上 | ⚠️ 同上 | ✅ | ⚠️ 同上 |

> **light 模式 warning fg `oklch(74%)` 的鲜亮浅黄在白底下可读性偏低**——这是 alpha-soft 双主题统一的固有代价。设计稿在 light 下原本用 `--warn-soft` 透底 + `--warn` `#f59e0b`（base 同色），与本卡完全等价。如走查发现问题，**警告/状态文字本身不应作为正文承载关键信息**，应配合 icon + 上下文文字（fg-default）；如确需调整，留 follow-up CHG-UI-04a 单独处理 light warning 文字色。

---

## 复核动作

CHG-UI-06 视觉走查时执行：

1. dark / light 各打开 `/admin/videos`、`/admin/moderation`、`/admin/sources` 页面
2. 截图归档至 `tests/visual/admin-ui-tokens/CHG-UI-04/`
3. 上述 12 项消费组件逐一勾选
4. 发现 contrast 不达标项 → 立卡 follow-up（不阻塞 CHG-UI-04 收口）

---

## 关联

- **方案真源**：`docs/designs/backend_design_v2.1/ui-token-alignment-plan.md` §4.4
- **任务卡**：CHG-UI-04（本卡）/ CHG-UI-05（消费方层走查会复用本清单）/ CHG-UI-06（视觉收口）
- **ADR**：ADR-111（CHG-UI-04 PASS 后回填正式决策内容）
- **风险登记**：light warning 文字可读性观察项（CHG-UI-06 视觉走查时确认）
