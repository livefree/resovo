# 消费方 Token 槽位全栈审计报告（CHG-UI-05）

> status: active
> owner: @engineering
> scope: SEQ-20260503-01 CHG-UI-05 交付物
> source_of_truth: yes
> last_reviewed: 2026-05-03
>
> 审计范围：`packages/admin-ui/src/**` + `apps/server-next/src/**` 全部 `var(--bg-*)` / `var(--surface-*)` / `var(--border-*)` / `var(--fg-*)` 引用
> 审计时间：2026-05-03
> 总扫描：56 个文件，130 处 `--bg-*` 引用 + 其他 token 系列

---

## 1. 槽位语义对照表（裁判依据）

按方案 §4.5.3 + 设计稿 `tokens.css`：

| 设计槽位 | 用例 | 应消费 token | 实装 token 值（dark） |
|---|---|---|---|
| `--bg0` page canvas | 整壳最底层 / main 内边距 | `--bg-canvas` | oklch(6.5%) |
| `--bg1` shell | 侧边栏 / 顶栏 / drawer 壳 | `--bg-surface` | oklch(11.2%) |
| `--bg2` card | 卡片 / 表格容器 / 内容卡 / pagination | `--bg-surface-raised` | oklch(13.5%) |
| `--bg3` row hover / input | input / row hover / chip 默认底 / kbd 提示 | `--bg-surface-row` | oklch(16.5%) |
| `--bg4` popover | dropdown / popover / modal / drawer 弹层 / sticky bottom action bar | `--bg-surface-elevated` | oklch(23%) |
| 容器内子区 | thead / filter-chips slot | `transparent` 继承父 | — |

---

## 2. 已确认错位清单（13 项 + DataTable 行级 CSS）

| # | 文件:行 | 当前引用 | 应改为 | 设计依据 | 修正策略 |
|---|---|---|---|---|---|
| 1 | `packages/admin-ui/src/shell/topbar.tsx:86` | `--bg-surface-raised` | `--bg-surface-row` | 全局搜索 trigger = input | 替换 |
| 2 | `packages/admin-ui/src/components/data-table/data-table.tsx:326` | `--bg-surface-elevated` | `--bg-surface-row` | DataTable row hover | 替换 |
| 3 | `packages/admin-ui/src/components/data-table/dt-styles.tsx:96` | `var(--bg-surface)` | `transparent` | 隐藏列 chip 在 toolbar，应继承 raised 容器底 | 替换 |
| 4 | `packages/admin-ui/src/components/data-table/dt-styles.tsx:130` | `var(--bg-surface)` | `transparent` | filter-chips slot 同上 | 替换 |
| 5 | `packages/admin-ui/src/components/data-table/dt-styles.tsx:295` | `var(--bg-surface)` | `var(--bg-surface-row)` | pager btn hover = row hover 槽位 | 替换 |
| 6 | `apps/server-next/src/app/login/LoginForm.tsx:76, 93` | `--bg-surface-raised` | `--bg-surface-row` | input field（设计 `--bg3`） | 替换 |
| 7 | `apps/server-next/src/app/admin/moderation/_client/PendingCenter.tsx:21` | `--bg-surface-elevated` | `--bg-surface-row` | 次级按钮 default = row 一档浮起 + border | 替换 |
| 8 | `packages/admin-ui/src/shell/task-drawer.tsx:76` | `--bg-surface-elevated` | `--bg-surface-row` | progress bar track = row（与 input 同档）| 替换 |
| 9 | `apps/server-next/src/app/admin/moderation/_client/ModerationConsole.tsx:34` | `--bg-surface-elevated` | `--bg-surface-row` | 次级按钮 BTN_SM default | 替换 |
| 10 | `apps/server-next/src/app/admin/moderation/_client/ModerationConsole.tsx:48` | `--bg-surface-elevated` | `--bg-surface-row` | segBtnStyle inactive default | 替换 |
| 11 | `packages/admin-ui/src/components/pagination/pagination.tsx:88` | `--bg-surface-elevated` | `--bg-surface-row` | `<select>` 是 input 类 | 替换 |
| 12 | `packages/admin-ui/src/components/state/loading-state.tsx:51` | `--bg-surface-elevated` | `--bg-surface-row` | skeleton row 与 row 同档 | 替换 |
| 13 | `packages/admin-ui/src/components/cell/pill.tsx:60` | `--bg-surface-raised` | `--bg-surface-row` | neutral pill 与其他 chip 同档（row 层） | 替换 |
| 14 | DataTable 行级 CSS 显式落地 | `data-table.tsx` rowStyle 内联 / `dt-styles.tsx` tbody 缺 border | 加 `tbody tr` border-bottom + `tr:last-child` border-none | 设计稿行分割线 | 在 dt-styles.tsx 加规则 |
| 15 | `apps/server-next/.../VideoEditDrawer.tsx:30/34/45` 3 处 | `var(--bg-inset)` 未定义 token | `var(--bg-surface-raised)` | drawer 内 sub-section 凹陷区 = bg2 | 替换 |
| 16 | `apps/server-next/.../_videoEdit/TabImages.tsx:13` | `var(--bg-inset)` 未定义 | `var(--bg-surface-raised)` | drawer tab 卡片层 | 替换 |
| 17 | `apps/server-next/.../_videoEdit/TabLines.tsx:23` | `var(--bg-inset)` 未定义 | `var(--bg-surface-raised)` | drawer 内 table-head | 替换 |
| 18 | `apps/server-next/.../_videoEdit/TabDouban.tsx:109/130/156` 3 处 | `var(--bg-inset)` 未定义 | `var(--bg-surface-raised)` | drawer 内 候选卡 / table-head | 替换 |

> **DEBT-UI-BG-INSET 闭环**：本卡顺手关闭。`--bg-inset` 8 处全部替换为 `--bg-surface-raised`（drawer-elevated 内回落一档的"凹陷子区"语义）。`verify-token-references.mjs` 现 PASS — 77 个引用全部已定义（324 token）。

> **判定备注**：经实施过程的逐项研判，#7-12 实际语义都不是"卡片面板"而是"按钮 / input / progress / skeleton 类"——它们应消费 `--bg-surface-row`（一档浮起的小元素），**不是** `--bg-surface-raised`（页面级卡片）。本表已修订对齐实施结论。
>
> **未列入修正**：
> - `apps/server-next/.../ModerationConsole.tsx:546` 浮动 toast/snack（`position: fixed`）：保留 `--bg-surface-elevated`（popover 类，正确）

---

## 3. 已审核保留（语义正确，不改）

| 文件:行 | 引用 | 上下文 | 保留原因 |
|---|---|---|---|
| `admin-ui/shell/admin-shell.tsx:114, 131` | `--bg-canvas` | 主壳 + main padding | 设计 `--bg0` ✅ |
| `admin-ui/shell/sidebar.tsx:69` | `--bg-surface` | 侧边栏容器 | 设计 `--bg1` ✅ |
| `admin-ui/shell/topbar.tsx:72` | `--bg-surface` | 顶栏容器 | 设计 `--bg1` ✅ |
| `admin-ui/shell/topbar.tsx:98` | `--bg-surface` | kbd 提示块 | 设计 `--bg1` 浮窗内嵌 ✅ |
| `admin-ui/shell/sidebar.tsx:651` | `--bg-surface-elevated` | drawer floating menu | popover 类 ✅ |
| `admin-ui/components/data-table/dt-styles.tsx:28` | `--bg-surface-raised` | DataTable 容器 | 设计 `--bg2` 卡片 ✅ |
| `admin-ui/components/data-table/dt-styles.tsx:197` | `--bg-surface-elevated` | DataTable bulk action sticky bottom | sticky 浮起底栏 ✅ |
| `admin-ui/components/data-table/dt-styles.tsx:244` | `--bg-surface-elevated` | DataTable foot pagination | sticky 浮起底栏 ✅ |
| `admin-ui/components/data-table/header-menu.tsx:46` | `--bg-surface-elevated` | header 集成菜单 popover | popover ✅ |
| `admin-ui/components/data-table/views-menu.tsx:33,62` | `--bg-surface-elevated` | views 下拉 popover | popover ✅ |
| `admin-ui/components/data-table/hidden-columns-menu.tsx:33` | `--bg-surface-elevated` | hidden cols popover | popover ✅ |
| `admin-ui/components/dropdown/admin-dropdown.tsx:43` | `--bg-surface-elevated` | dropdown popover | popover ✅ |
| `admin-ui/components/overlay/{modal,drawer}.tsx` | `--bg-surface-elevated` | modal/drawer | popover 类 ✅ |
| `admin-ui/components/data-table/selection-action-bar.tsx:41,120` | `--bg-surface-elevated` | sticky action bar / inline button | sticky 浮起 ✅ |
| `apps/server-next/.../{SiteHealthCard,RecentActivityCard,WorkflowCard,AttentionCard}.tsx` | `--bg-surface-raised` | dashboard 卡片 | 设计 `--bg2` ✅ |
| `apps/server-next/.../moderation/SavePresetModal.tsx:52` | `--bg-surface-elevated` | modal | popover 类 ✅ |
| `apps/server-next/.../moderation/FilterPresetPopover.tsx:25` | `--bg-surface-elevated` | popover | popover ✅ |
| `admin-ui/shell/{user-menu,command-palette,drawer-shell}.tsx` | mixed | popover 类 | popover ✅ |

---

## 4. 留给后续批次的观察项

| # | 涉及 | 现象 | 决策 |
|---|---|---|---|
| O1 | `apps/server-next/.../_videoEdit/TabDouban.tsx` STATUS_CHIP 用 `--bg-surface` 当 chip 底色 | status chip 应消费 `--state-*-bg` 而非 surface | 留 follow-up（第三批 tag-chip 饱和度回收） |
| O2 | `apps/server-next/.../moderation/StagingTabContent.tsx:36` row item 用 raised | row 类应 transparent + hover row | 留观察（业务侧未来重构 list-row 类时统一处理） |
| O3 | `apps/server-next/.../RightPane/{TabHistory,TabDetail}.tsx` inline tag 用 raised | inline tag 应 row 浮起一档 | 留观察 |
| O4 | `apps/server-next/.../_videoEdit/TabLines.tsx:30` chip 用 surface | 同 O1 | 留 follow-up |
| O5 | `apps/server-next/.../system/settings/SettingsContainer.tsx:78` content panel 用 surface | settings 内容面板应 raised（卡片层） | 留观察（业务页非高频，本卡聚焦核心路径） |
| O6 | `apps/server-next/.../admin/dev/components-demo.tsx` button bg 用 surface | demo 文件，影响极小 | 不改 |
| O7 | `admin-ui/shell/command-palette.tsx:118` row item 用 elevated | row 应 transparent + hover row | 留 follow-up（command-palette 尾随 row hover 改造） |

---

## 5. 修正批次

本卡按"语义同质 + 一次提交可全量 revert"原则**单 commit 落地**所有 15 项修正（13 槽位 + 1 行级 CSS + 1 audit report）。如视觉走查（CHG-UI-06）发现任一引发问题，整 commit revert 即可。

---

## 6. 完成判据

- [x] 13 处槽位错位全部修正（commit hash 待写入下方）
- [x] DataTable `tbody tr` 显式 `border-bottom: 1px solid var(--border-default)` + `tr:last-child` border-none
- [x] DataTable `tbody tr:hover` 使用 `--bg-surface-row`（同 #2 修正同源）
- [x] typecheck / lint / unit / tokens:validate 全绿
- [x] audit report 归档

修正 commit hash：_（commit 后回填）_

---

## 7. 关联

- **方案真源**：`docs/designs/backend_design_v2.1/ui-token-alignment-plan.md` §4.5
- **任务卡**：CHG-UI-05（本卡）
- **依赖完成的卡**：CHG-UI-02（surface-row 槽位引入）/ CHG-UI-03（fg）/ CHG-UI-04（state pill）
- **后续解锁**：CHG-UI-06（视觉走查 + 序列收口）
- **观察项 follow-up 触发条件**：第三批 tag-chip 11 色 / list-row 类业务重构 / settings 容器对齐
