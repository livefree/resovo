/**
 * interaction-styles.tsx — admin Shell 交互反馈全局规则注入（CHG-UX-01 / SEQ-20260504-01）
 *
 * 解决问题：
 *   - admin-ui 多处可点击元素（topbar IconButton / 全局搜索 / dropdown trigger / 表头按钮等）
 *     完全没有 hover 反馈；用户验收痛点
 *   - 已有 hover 选择器分散在 admin-shell-styles / dt-styles / inline-row-actions-styles，
 *     槽位写死、duration 写裸值
 *
 * 方案：
 *   单一 <style> 注入 5 类全局规则 + focus-visible 兜底 + reduced-motion 处理
 *   消费方通过 data-interactive="icon|trigger|nav|chip" 标记属性接入，零 className，
 *   零业务层 :hover CSS。详见 docs/designs/backend_design_v2.1/ux-interactive-feedback-plan.md §5。
 *
 * 双轨期约束：
 *   - 本文件不删除 admin-shell-styles 中既有 [data-sidebar-item]:hover / [data-menu-item]:hover
 *     等规则；CHG-UX-02 才迁移
 *   - 本文件 [data-interactive="nav"]:hover 与既有 [data-sidebar-item]:hover 选择器优先级一致，
 *     双跑期内既有元素若没加 data-interactive 标记，仍走 admin-shell-styles 规则；标记后两者并存
 *     但视觉一致（hoverStrong = surface-row 等同于既有 surface-raised）
 *
 * Token 引用：
 *   - --interactive-hover-soft / -hover-strong / -press-soft / -focus-ring-{color,width,offset}
 *     来自 packages/design-tokens/src/semantic/interactive.ts
 *   - --duration-fast / --easing-ease-out 来自 motion primitives（自动发布）
 *
 * 与 admin-shell-styles.tsx 的关系：
 *   - 同为 AdminShell 渲染的 <style> 注入；同时挂载，规则不冲突（选择器互斥）
 *   - admin-shell-styles 负责 sidebar layout / scrollbar / pulse 等"基础设施"
 *   - 本文件负责"交互反馈语义层"
 *
 * 关于 !important（CHG-UX-05c 设计决策）：
 *   - React inline `style={{ background: ... }}` 的 CSS specificity（author inline）
 *     高于任何 stylesheet 规则；不用 !important 的话，stylesheet 的 :hover background
 *     会被消费方 inline default background（如 'transparent'）覆盖
 *   - 业界共识：React inline + stylesheet hover 共存，hover 状态规则需 !important
 *   - 本文件仅在 hover/active 等"瞬态"规则上用 !important，default 规则不用；
 *     消费方 inline default 仍受尊重（语义：default 由消费方决定，hover 由设计系统决定）
 */

const INTERACTION_CSS = `
/* ── 1. icon-button：透明背景 ghost 类 ───────────────────────────── *
 * 用途：topbar IconButton / DataTable 表头 sort 按钮 / staff-note edit / 等
 * hover：currentColor 6-8% 透明叠加（hoverSoft）
 * active：currentColor 12-16% 透明叠加（pressSoft）
 * 不动 fg/border — 让消费方 inline color 决定 hover 色调（state-error fg 元素 hover 出红叠加） */
[data-interactive="icon"]:not(:disabled) {
  transition: background var(--duration-fast) var(--easing-ease-out);
}
[data-interactive="icon"]:not(:disabled):hover {
  background: var(--interactive-hover-soft) !important;
}
[data-interactive="icon"]:not(:disabled):active {
  background: var(--interactive-press-soft) !important;
}

/* ── 2. trigger：input / select / dropdown 触发器 ───────────────── *
 * 用途：topbar 全局搜索框 / DataTable views-menu trigger / VideoFilterFields input 等
 * hover：仅 border-color → strong；不动 background（让 inline 提供的 surface-row 不变） */
[data-interactive="trigger"]:not(:disabled) {
  transition: border-color var(--duration-fast) var(--easing-ease-out),
              background var(--duration-fast) var(--easing-ease-out);
}
[data-interactive="trigger"]:not(:disabled):hover {
  border-color: var(--border-strong) !important;
}

/* ── 3. nav-item：sidebar / menu / 列表型导航项 ──────────────────── *
 * 用途：sidebar nav / sidebar foot / collapse btn / user-menu 项 等
 * hover：bg → hoverStrong（=surface-row）
 * active 态（data-active="true"）由消费方 inline 提供 admin-accent-soft，本规则不动
 * danger 态（data-danger="true"）单独处理 */
[data-interactive="nav"]:not([data-active="true"]):not(:disabled) {
  transition: background var(--duration-fast) var(--easing-ease-out),
              color var(--duration-fast) var(--easing-ease-out);
}
[data-interactive="nav"]:not([data-active="true"]):not(:disabled):hover {
  background: var(--interactive-hover-strong) !important;
}
[data-interactive="nav"][data-danger="true"]:not(:disabled):hover {
  background: var(--admin-danger-soft) !important;
}

/* ── 4. chip：filter-chip-clear / hidden-cols-chip / pager-btn 等 ─ *
 * 仅注入统一 transition；具体 hover 视觉由元素自身 CSS 决定（dt-styles 已配） */
[data-interactive="chip"]:not(:disabled) {
  transition: background var(--duration-fast) var(--easing-ease-out),
              color var(--duration-fast) var(--easing-ease-out),
              border-color var(--duration-fast) var(--easing-ease-out);
}

/* ── 5. focus-visible 全站兜底 ─────────────────────────────────── *
 * 显式标记元素 + admin Shell 范围内常见可达元素；都给 outline focus-ring
 * 不在 admin Shell 范围内的应用层（player / web-next）由各自管线处理 */
[data-interactive]:focus-visible,
[data-admin-shell] button:focus-visible,
[data-admin-shell] [role="button"]:focus-visible,
[data-admin-shell] [role="menuitem"]:focus-visible,
[data-admin-shell] a:focus-visible {
  outline: var(--interactive-focus-ring-width) solid var(--interactive-focus-ring-color);
  outline-offset: var(--interactive-focus-ring-offset);
}

/* ── 6. prefers-reduced-motion：去 transition 不去反馈 ─────────── */
@media (prefers-reduced-motion: reduce) {
  [data-interactive] {
    transition: none;
  }
}
` as const

export function InteractionStyles() {
  return <style data-admin-interaction-styles dangerouslySetInnerHTML={{ __html: INTERACTION_CSS }} />
}
