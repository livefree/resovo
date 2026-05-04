# UX 完整性序列 · 第一批：交互反馈（hover / focus / active）统一方案

> sequence_id: SEQ-20260504-01
> status: ✅ 已完成（CHG-UX-01..07 全部合并；CHG-UX-06 收口）
> owner: @engineering
> created: 2026-05-03
> last_updated: 2026-05-03
> 关联：SEQ-20260503-01 收口 §独立批次登记 / ADR-111 §后续序列触发清单 / ADR-112（本序列产出）

---

## §1 背景与触发

SEQ-20260503-01 收口阶段，用户验收时反馈：

> 「除了表格行，其他可点击按钮，包括导航栏，top bar 按钮，表头按钮等大多没有 hover 颜色变化。」

颜色 token 序列只对齐 surface/fg/border/state 静态语义；**交互反馈（hover/focus/active）当时显式排除**，登记为独立批次。本方案启动这个批次。

---

## §2 现状盘点（2026-05-03）

### §2.1 已具备的 hover 反馈

来源 1 — `packages/admin-ui/src/shell/admin-shell-styles.tsx`（admin Shell 全局注入）：

| 选择器                                              | 反馈                            | duration  | 触发面 |
| --------------------------------------------------- | ------------------------------- | --------- | ------ |
| `[data-sidebar-item]:not(active):hover`             | bg → `--bg-surface-raised`      | 120ms ease | nav    |
| `[data-sidebar-foot]:hover`                         | bg → `--bg-surface-raised`      | 120ms ease | nav    |
| `[data-sidebar-collapse]:hover`                     | bg → `--bg-surface-raised`      | 120ms ease | nav    |
| `[data-menu-item]:hover`                            | bg → `--bg-surface-raised`      | 120ms ease | menu   |
| `[data-menu-item][danger]:hover`                    | bg → `--admin-danger-soft`      | 120ms ease | menu   |
| `*::-webkit-scrollbar-thumb:hover`                  | bg → `--fg-disabled`            | —         | global |

来源 2 — `packages/admin-ui/src/components/data-table/dt-styles.tsx`：

| 选择器                                                                        | 反馈                          | duration |
| ----------------------------------------------------------------------------- | ----------------------------- | -------- |
| `[data-table-toolbar-hidden-cols-chip]:hover`                                 | fg/border 双切                 | —        |
| `[data-table-filter-chip-clear]:hover`                                        | bg/fg 双切                     | —        |
| `[data-table-bulk-clear]:hover`                                               | fg/border 双切                 | —        |
| `[data-table-foot-pagesize] select:hover`                                     | border-color → strong          | —        |
| `[data-table-foot-pager-btn]:hover:not(:disabled):not([data-active="true"])` | bg/fg → `--bg-surface-row`     | —        |

来源 3 — `packages/admin-ui/src/components/cell/inline-row-actions-styles.tsx`：

| 选择器                                                              | 反馈                  | duration             |
| ------------------------------------------------------------------- | --------------------- | -------------------- |
| `tr:hover [data-row-actions]:not([data-always-visible="true"])`    | opacity 0 → 1         | 200ms cubic-bezier   |
| `[role="row"]:hover [data-row-actions]:not(...)`                    | 同上                  | 同上                 |

### §2.2 JS state 驱动的"伪 hover"

| 组件                              | state                                      | 高亮槽位                              |
| --------------------------------- | ------------------------------------------ | ------------------------------------- |
| `AdminDropdown` menu item         | `activeIndex`（kbd↑↓ + onMouseEnter 同步） | bg → `--admin-accent-soft` / `--admin-danger-soft` |
| `CommandPalette` item             | `activeIndex`（同上）                      | 同上                                  |
| `Sidebar` collapsed nav item      | `hoveredNav`（弹 NavTip 浮层）             | tooltip portal                        |
| `DataTable` row                   | `hoveredKey`（inline rowStyle）            | bg → `--bg-surface-row`，80ms transition |

### §2.3 缺失 hover 的高交互点（用户痛点）

| 元素                                                              | 现状                                | 痛点                              |
| ----------------------------------------------------------------- | ----------------------------------- | --------------------------------- |
| `Topbar` IconButton 4 个（theme/notifications/tasks/settings）   | 仅 inline `ICON_BTN_STYLE`，无 hover | 用户主入口点击靶子无反馈          |
| `Topbar` SEARCH_TRIGGER（全局搜索框）                            | 无 hover                            | CmdK 入口不明显                   |
| `views-menu` TRIGGER（DataTable 视图切换 chip）                  | 无 hover                            | 用户反馈直接命中                  |
| `staff-note-bar` EDIT_TRIGGER                                     | 无 hover                            | 详情区主操作                      |
| DataTable 表头排序/过滤切换按钮（th 内）                         | 无 hover                            | 用户反馈直接命中                  |
| `VideoFilterFields` 各 input/select（toolbar 内）                | 无 hover                            | 表内查询主操作                    |
| `pagination-foot` 容器外围（label 区）                            | 仅 select 元素自身有 hover          | 触发面积小                        |

### §2.4 token 层现状

- `accent.hover/active` 已存在（`packages/design-tokens/src/semantic/accent.ts`）
- `button.ts` / `input.ts` 4 variant × 5 状态契约齐备，但**消费方未使用**（admin-ui 都自写 inline style）
- **缺失"通用 hover 叠加"语义槽位** — 现在 nav/menu hover 写死 `--bg-surface-raised`；但 raised 已是 DataTable 容器底，对 ghost button 在 DataTable toolbar 内 hover 没有反差
- 缺失"hover overlay"语义（弱透明 fg 叠加，与具体 surface 解耦）

### §2.5 motion 层现状

- `motion.duration.fast = 120ms` / `base = 200ms` 已有
- `motion.easing` 已有 ease-out / ease-in-out
- 但 admin-shell-styles 写裸 `120ms ease`，dt-styles 部分 hover 没有 transition；DataTable row hover 写裸 `80ms`
- `prefers-reduced-motion` 仅 4 处声明（sidebar / flash / pulse / row-actions）

---

## §3 设计目标

1. **统一可见性**：所有 mouse-pointer 可点击元素必须有视觉 hover 反馈；键盘可达元素必须有 focus-visible 反馈
2. **token 化**：反馈值零硬编码、零裸时长、零裸缓动
3. **消费方零成本**：admin-ui 注入全局规则 + 标记属性即生效；server-next/web-next 业务层不写 hover/focus CSS
4. **可扩展**：新增交互类型只需扩 `InteractiveKind` union + 增一条全局规则
5. **不破坏**：现有 hover（sidebar/menu/row）仍工作，只做 token 化迁移
6. **a11y**：focus-visible 全站兜底，prefers-reduced-motion 全覆盖

---

## §4 token 层方案

### §4.1 新增 semantic 槽位 `interactive`

新建 `packages/design-tokens/src/semantic/interactive.ts`：

```ts
import { surface } from './surface.js'
import { border } from './border.js'

/**
 * 交互反馈语义槽位（CHG-UX-01 / SEQ-20260504-01）
 *
 * 与现有 surface/border 的关系：
 *   - hoverSoft：弱透明叠加，不依赖具体 surface 档位 — ghost/icon button 在任何容器
 *     （topbar / surface-raised / surface-elevated）上都保持可见反差
 *   - hoverStrong：复用 surface-row，保持现有 nav/menu/row 的视觉一致
 *   - pressSoft：active 反馈（mousedown / touchstart）
 *   - focusRingColor：focus-visible 焦点环颜色（指向 border-focus）
 *
 * 与 button.ts hover 状态契约的关系：
 *   - button.ts 是「按钮变体的完整状态包」（5 状态 × 4 variant × 3 size），
 *     消费方需通过 button-class / props 整体接入
 *   - interactive 槽位是「轻量交互叠加」，用于已有自定义样式的元素
 *     仅追加 hover/focus/active 叠加层（admin-ui 全局规则消费）
 */
export const interactive = {
  light: {
    hoverSoft: 'color-mix(in oklch, currentColor 6%, transparent)',
    hoverStrong: surface.light.surfaceRow,
    pressSoft: 'color-mix(in oklch, currentColor 12%, transparent)',
    focusRingColor: border.light.focus,
    focusRingWidth: '2px',
    focusRingOffset: '2px',
  },
  dark: {
    hoverSoft: 'color-mix(in oklch, currentColor 8%, transparent)',
    hoverStrong: surface.dark.surfaceRow,
    pressSoft: 'color-mix(in oklch, currentColor 16%, transparent)',
    focusRingColor: border.dark.focus,
    focusRingWidth: '2px',
    focusRingOffset: '2px',
  },
} as const

export type InteractiveTheme = keyof typeof interactive
export type InteractiveSlot = keyof typeof interactive.light
```

**为什么用 `currentColor` 而非具体 fg**：currentColor 自动跟随消费方 `color`（fg-default / fg-muted / state-error-fg），不会出现"红色 danger 按钮 hover 出蓝色叠加"的语义错配。

**生成 CSS 变量**（`build-css.mjs` 已有自动管线）：
- `--interactive-hover-soft`
- `--interactive-hover-strong`
- `--interactive-press-soft`
- `--interactive-focus-ring-color`
- `--interactive-focus-ring-width`
- `--interactive-focus-ring-offset`

### §4.2 motion duration / easing 已有，只补 var(--duration-fast) 等的 css 变量发布

`build-css.mjs` 现状是否已经发布 motion 的 var：审查时 grep 一次确认；如未发布则在 CHG-UX-01 补齐 `--duration-fast` `--duration-base` `--easing-ease-out` `--easing-ease-in-out`。

### §4.3 不动

- `accent.hover/active`：已是 brand 状态色，与本方案的"叠加层"语义不同 — 一个用于 primary button bg，一个用于 ghost overlay
- `button.ts` / `input.ts` 5 状态契约：保留，作为完整 component 状态包的入口
- `--admin-accent-soft` / `--admin-danger-soft`：active state 槽位，与 hover 是不同层

---

## §5 admin-ui 全局规则方案

### §5.1 新建 `packages/admin-ui/src/shell/interaction-styles.tsx`

由 `AdminShell` 渲染（与 `admin-shell-styles.tsx` 同级）。注入以下全局规则：

```css
/* === 1. icon-button：透明背景 ghost 类（topbar 4 图标 / 表头 sort 按钮等） === */
[data-interactive="icon"]:not(:disabled) {
  transition: background var(--duration-fast) var(--easing-ease-out);
}
[data-interactive="icon"]:not(:disabled):hover {
  background: var(--interactive-hover-soft);
}
[data-interactive="icon"]:not(:disabled):active {
  background: var(--interactive-press-soft);
}

/* === 2. trigger：input / select / dropdown 触发器 === */
[data-interactive="trigger"]:not(:disabled) {
  transition: border-color var(--duration-fast) var(--easing-ease-out),
              background var(--duration-fast) var(--easing-ease-out);
}
[data-interactive="trigger"]:not(:disabled):hover {
  border-color: var(--border-strong);
}

/* === 3. nav-item：sidebar / menu / sidebar foot / collapse btn ===
 * 迁移已有 [data-sidebar-item]:hover / [data-menu-item]:hover 规则
 * 改为统一 [data-interactive="nav"] 选择器，token 化时长/缓动 */
[data-interactive="nav"]:not([data-active="true"]):not(:disabled) {
  transition: background var(--duration-fast) var(--easing-ease-out),
              color var(--duration-fast) var(--easing-ease-out);
}
[data-interactive="nav"]:not([data-active="true"]):not(:disabled):hover {
  background: var(--interactive-hover-strong);
}
[data-interactive="nav"][data-danger="true"]:not(:disabled):hover {
  background: var(--admin-danger-soft);
}

/* === 4. chip：filter-chip-clear / hidden-cols-chip / bulk-clear / pager-btn === */
[data-interactive="chip"]:not(:disabled) {
  transition: background var(--duration-fast) var(--easing-ease-out),
              color var(--duration-fast) var(--easing-ease-out),
              border-color var(--duration-fast) var(--easing-ease-out);
}

/* === 5. focus-visible 全站兜底 === */
[data-interactive]:focus-visible,
button:focus-visible,
[role="button"]:focus-visible,
[role="menuitem"]:focus-visible,
a:focus-visible {
  outline: var(--interactive-focus-ring-width) solid var(--interactive-focus-ring-color);
  outline-offset: var(--interactive-focus-ring-offset);
}

/* === 6. prefers-reduced-motion === */
@media (prefers-reduced-motion: reduce) {
  [data-interactive] {
    transition: none;
  }
}
```

### §5.2 admin-shell-styles 迁移

将 `admin-shell-styles.tsx` 中：
- `[data-sidebar-item]` / `[data-sidebar-foot]` / `[data-sidebar-collapse]` / `[data-menu-item]` 的 hover 规则**整体删除**
- 在对应消费方组件给 button/li 加 `data-interactive="nav"` 即可继承 §5.1 规则
- 保留 nav active indicator `::before` / 折叠过渡 transition / scrollbar / pulse keyframe

### §5.3 dt-styles 微调

DataTable 内已有的 chip/btn hover 规则**保留**（已 token 化），只补：
- `[data-table-toolbar-hidden-cols-chip]` / `[data-table-filter-chip-clear]` / `[data-table-bulk-clear]` / `[data-table-foot-pager-btn]` 加 `data-interactive="chip"` → 自动获得统一 transition
- 表头 th cell + sort 切换按钮：在 `data-table.tsx` 给 sort button 加 `data-interactive="icon"`
- DataTable row hover：保留 `hoveredKey` JS state（已 token 化 `--bg-surface-row`），只把 80ms 改为 `var(--duration-fast)` token

---

## §6 消费方契约

### §6.1 标记属性合约

| `data-interactive` 值 | 适用元素                                 | hover 行为                              |
| --------------------- | ---------------------------------------- | --------------------------------------- |
| `"icon"`              | 图标按钮（topbar / 表头 sort / staff edit etc）| 弱透明叠加（hover-soft）                |
| `"trigger"`           | 带边框的触发器（input / select / dropdown trigger）| border-strong + 选填 bg                 |
| `"nav"`               | 列表型导航项（sidebar / menu / etc）        | 强叠加（hover-strong = surface-row）    |
| `"chip"`              | 圆角小元素（filter chip / pager btn）        | 由元素自身 css 决定，仅获得统一 transition |

### §6.2 admin-ui 类型导出

```ts
// packages/admin-ui/src/index.ts 追加
export type InteractiveKind = 'icon' | 'trigger' | 'nav' | 'chip'
```

消费方使用：

```tsx
<button data-interactive="icon" aria-label="设置" onClick={...}>
  <Icon />
</button>
```

### §6.3 禁止与例外

- ❌ 消费方不得在业务层写 `:hover { ... }` CSS — 全部用 `data-interactive`
- ❌ inline style 不得写死 default `background`（除 transparent / 全局规则会被 inline 优先级压住）
  - 例外：`data-interactive="nav"` active 态 `background: var(--admin-accent-soft)` 是允许的（active 高于 hover）
  - 例外：`data-interactive="trigger"` 可保留 inline `background: var(--bg-surface-row)`（hover 改 border 不改 bg，无冲突）
- ❌ 不得新增第二条全局 hover 规则覆盖 §5.1（统一性约束）

---

## §7 实施分卡

序列 ID：**SEQ-20260504-01** · 总计 6 卡 + 1 收口

### CHG-UX-01 · token + 全局规则注入
- 范围：
  - 新增 `packages/design-tokens/src/semantic/interactive.ts` + index 导出
  - `build-css.mjs` 确认 motion 已发布 var；缺则补
  - 新增 `packages/admin-ui/src/shell/interaction-styles.tsx` 注入 §5.1 全局规则
  - `AdminShell` 内挂 `<InteractionStyles />`
  - 单测：interactive token 形态 + `--interactive-*` CSS 变量产出
- 风险：interaction 全局规则与既有 `[data-sidebar-item]:hover` 选择器优先级一致 — 本卡注入规则后两者并存（双跑期），CHG-UX-02 才删旧规则
- 不动：admin-shell-styles / dt-styles 既有规则
- 建议模型：sonnet
- 子代理：spawn `arch-reviewer` (claude-opus-4-7) 评 interactive 槽位语义边界 + currentColor 选择是否合规

### CHG-UX-02 · sidebar / menu hover 迁移
- 范围：
  - `admin-shell-styles.tsx` 删除 `[data-sidebar-item]` / `[data-sidebar-foot]` / `[data-sidebar-collapse]` / `[data-menu-item]` 的 hover/transition 规则
  - 消费方 `sidebar.tsx` / `user-menu.tsx` 的对应元素加 `data-interactive="nav"`（部分加 `data-active="true"` 标识活跃态）
  - 同步注释（指向 §5）
- 完成判据：sidebar 折叠过渡 + active indicator + hover 反差三者全部正常；视觉零回归
- 风险：sidebar collapsed 态有 `hoveredNav` JS portal tooltip，需确认 `data-interactive` 标识不冲突
- 建议模型：sonnet

### CHG-UX-03 · topbar IconButton + 全局搜索 trigger hover
- 范围：
  - `topbar.tsx` IconButton：`<button>` 加 `data-interactive="icon"`
  - `topbar.tsx` SEARCH_TRIGGER：加 `data-interactive="trigger"`
  - 移除 inline `disabled` 时的 `cursor: 'not-allowed'`（让全局 :disabled 处理）— 仅做 token 化精修
- 完成判据：4 个 icon button 在 dark / light 模式下 hover 都有可见反差；搜索框 hover border 变深
- 建议模型：sonnet

### CHG-UX-04 · dropdown trigger / staff-note edit / VideoFilterFields hover
- 范围：
  - `views-menu.tsx` TRIGGER：加 `data-interactive="trigger"`
  - `staff-note-bar.tsx` EDIT_TRIGGER：加 `data-interactive="icon"`
  - `apps/server-next/.../VideoFilterFields.tsx` 各 input/select：加 `data-interactive="trigger"`
- 完成判据：3 类 trigger 在表内 toolbar / topbar / 详情区 hover 反馈一致
- 建议模型：sonnet

### CHG-UX-05 · DataTable 表头 + foot 内 hover 收尾
- 范围：
  - `data-table.tsx` 表头列 sort/filter 按钮：加 `data-interactive="icon"`
  - `dt-styles.tsx` 已有 chip/btn 加 `data-interactive="chip"`（如 §5.3 所述）
  - row hover transition 80ms → `var(--duration-fast)`
  - foot pagesize 容器整体 hover 触发面（保留 select:hover，外加 label 整 wrap）
- 完成判据：表头排序按钮 hover 可见；行 hover 时长统一
- 风险：表头 enableHeaderMenu 集成菜单与 sort 按钮可能并存，需确认 hover 优先级
- 建议模型：sonnet

### CHG-UX-06 · focus-visible 全站走查 + 序列收口
- 范围：
  - 视觉走查 keyboard tab 全站，确认 focus-ring 显示
  - 修复个别元素 outline: 0 / outline: none 漏写（admin-ui 应零此类硬编码）
  - 关闭欠账 / 更新 ADR / 写 audit report
- 子代理（强制）：spawn `arch-reviewer` (claude-opus-4-7) 全序列评级
- 完成判据：A 或 B+ → 收口；C → BLOCKER
- 建议模型：opus

---

## §8 不在本序列范围

- 业务文件 inline style 系统性重构（用 className / variant prop 替代）— 留到独立架构序列
- `button.ts` / `input.ts` 5 状态契约真实接入（admin-ui Button 组件复用）— 当前 admin-ui 主要用 inline + 全局规则；该重构属于"组件库正式接入" milestone
- 各种动画特效（spring / ripple / morph）— 只做基础反馈
- 移动端 touch 长按反馈、键盘 Enter 高亮等扩展交互
- 颜色 token 进一步精修（属于 SEQ-20260503-01 后续批次第二/三批，已登记）

---

## §9 验收标准

- 视觉：所有 §2.3 列出的"缺失 hover 高交互点"全部具备 hover 反馈
- 键盘：tab 遍历全站，每一可达元素有 focus-ring
- 一致性：hover/focus/active 三态在不同模块（sidebar / topbar / dropdown / table）遵循同一槽位映射
- token：`grep -rn "px\|ms\|cubic-bezier\|color-mix" packages/admin-ui/src --include="*.tsx"` hover/focus 上下文 0 裸值（除已记录例外）
- 测试：`npm run typecheck / lint / test -- --run / tokens:validate / verify-token-references` 全绿
- arch-reviewer：CHG-UX-01 + CHG-UX-06 PASS / CONDITIONAL ≤ 3 轮闭环

---

## §10 关键约束（违反 = BLOCKER）

- ❌ 在业务层文件（apps/server-next / apps/web-next）写 `:hover` / `:focus` CSS
- ❌ admin-ui 引入两套并行 hover 选择器策略（除 CHG-UX-01 → CHG-UX-02 的双跑过渡期）
- ❌ 硬编码 hover 颜色 / 时长 / 缓动
- ❌ `outline: 0` / `outline: none` 不带配套 focus-ring 替代
- ❌ 跳过 CHG-UX-01 的 token 层直接在 admin-ui 写 hover 规则
- ❌ 修改 `accent.hover/active` 语义槽位（属 brand 状态色，不在本批范围）

---

## §11 后续触发型 follow-up（不主动启动）

- **CHG-UX-EXT-A**：button.ts / input.ts 5 状态契约真实接入 — 触发：admin-ui Button 组件正式立项
- **CHG-UX-EXT-B**：移动端 touch 反馈（pressSoft 已埋点 active state） — 触发：admin 移动端体验立项
- **CHG-UX-EXT-C**：spring/ripple 等高级动效 — 触发：用户体验度量后明确需求

---

## §12 关联

- 上一序列：SEQ-20260503-01（颜色 token 第一批 ✅ B+ PASS CONDITIONAL）
- ADR：拟以本序列收口产出 ADR-112（交互反馈语义槽位）
- 依赖：BrandProvider / AdminShell 已就绪（M-SN-2 完成）；motion primitives 已就绪
