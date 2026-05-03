'use client'

/**
 * dt-styles.tsx — DataTable 自包含 CSS 注入（CHG-DESIGN-02 Step 2/7）
 *
 * 设计原则（参 CHG-DESIGN-04 fix#5 教训）：
 *   - DataTable 是 packages/admin-ui 公共导出组件，**禁止依赖 admin-shell-styles 私有注入**。
 *   - 本文件由 DataTable 内部渲染 <DTStyles /> 一次性注入；模块级 flag 防重复注入，
 *     多个 DataTable 实例共享同一份 <style> 标签。
 *
 * 范围（仅含设计稿 .dt 框架专属、不重写已经 inline 工作的部分）：
 *   - .dt framed surface（外层容器视觉）
 *   - .dt__toolbar / .dt__body / .dt__foot 子结构留位（未来 step 填充）
 *   - .dt__pop popover / .dt__bulk sticky bottom / .dt__pager 紧凑分页器
 *   - is-flash row 动画 keyframe
 *   - 不重写 row hover/selected（仍 inline 工作；arch-reviewer C-3 约束）
 *
 * 命名空间：所有选择器以 `[data-table]` 后代或 `.dt__*` className 前缀，
 * 不污染外层 page 样式。
 */
import { useEffect } from 'react'

const STYLE_ID = 'admin-ui-dt-styles'

const DT_CSS = `
/* ── DataTable framed surface（reference.md §4.4 + 设计稿 .dt） ─────── */
[data-table] {
  background: var(--bg-surface-raised);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  overflow: hidden;
  height: 100%;
  /* CHG-DESIGN-02 Step 7A：防御性兜底
   * 消费方未提供 height 约束（如父容器无 height: calc(...)）时，
   * 至少保留 240px 可视高度，避免 flex 链下塌成 0；正确"body 独立滚动"
   * 体验仍需消费方在父级提供 height 约束（视频库 / 审核台等独立 height 路径）。
   */
  min-height: 240px;
  /* min-width: 0 打破 grid/flex 父链 auto 阻断，确保 frame 自身不被宽内容撑大 */
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/* ── DataTable 单一 scrollport（CHG-DESIGN-02 Step 7B fix#2 / Codex review）─────── *
 * 横向 + 纵向滚动统一在本容器内发生（双轴 overflow:auto）。thead / body rows /
 * bulk bar 共享同一 scrollLeft，避免横纵 viewport 分裂导致垂直滚动条随 scrollLeft
 * 漂移。foot 留在 [data-table] frame 直接子层（外层固定底栏，不进 scrollport）。 */
[data-table-scroll] {
  flex: 1 1 auto;
  /* min-height: var(--row-h) 兜底短数据时 thead/foot/bulk 视觉重叠（arch-reviewer R-3）；
   * min-height: 0 让 flex item 能被 container 压缩。两者合一取较大值。 */
  min-height: var(--row-h, 40px);
  /* min-width: 0 让 scrollport 自身宽度不被内容撑出 frame */
  min-width: 0;
  overflow: auto;
  /* sticky 子（thead / bulk）需要 contain: paint 保证不被横滚带飞，
   * 主流浏览器 sticky 实现已经处理；此处不强制。 */
}

/* ── body wrapper（语义 marker，不再独立滚动）─────── *
 * Step 7B fix#2：纵向滚动迁到父级 [data-table-scroll]，本节点仅承载 role=rowgroup
 * 语义和测试选择器引用，不重复设置 overflow / flex / min-height（避免与父链冲突）。 */
[data-table-body] {
  display: contents;
}

/* ── DataTable 内置 toolbar（CHG-DESIGN-02 Step 4，设计稿 .dt__toolbar） ─────── */
[data-table-toolbar] {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-default);
  flex-wrap: wrap;
  flex-shrink: 0;
}
[data-table-toolbar-search] {
  flex: 0 0 auto;
  min-width: 200px;
}
[data-table-toolbar-trailing] {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex-shrink: 0;
}

/* ── 隐藏列 chip（CHG-DESIGN-02 Step 7A） ─────── */
[data-table-toolbar-hidden-cols-chip] {
  height: var(--row-h-compact, 24px);
  padding: 0 10px;
  border: 1px solid var(--border-default);
  border-radius: 999px;
  background: transparent;
  color: var(--fg-muted);
  font: inherit;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
[data-table-toolbar-hidden-cols-chip]:hover {
  color: var(--fg-default);
  border-color: var(--border-strong);
}
[data-table-toolbar-hidden-cols-chip][aria-expanded="true"] {
  background: var(--admin-accent-soft);
  color: var(--admin-accent-on-soft);
  border-color: var(--admin-accent-border);
}
[data-table-toolbar-hidden-cols-chip] em {
  font-style: normal;
  font-weight: 700;
  color: var(--admin-accent-on-soft);
}

/* ── filter chips slot（CHG-DESIGN-02 Step 7A，独立第二 flex row）─────── */
[data-table-filter-chips] {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-default);
  background: transparent;
  flex-shrink: 0;
}
[data-table-filter-chip] {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: var(--row-h-compact, 24px);
  padding: 0 4px 0 10px;
  border: 1px solid var(--admin-accent-border);
  border-radius: 999px;
  background: var(--admin-accent-soft);
  color: var(--admin-accent-on-soft);
  font-size: 12px;
  line-height: 1;
  flex-shrink: 0;
}
[data-table-filter-chip-label] {
  font-weight: 500;
}
[data-table-filter-chip-sep] {
  color: var(--fg-muted);
}
[data-table-filter-chip-value] {
  color: var(--fg-default);
}
[data-table-filter-chip-clear] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-left: 4px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--fg-muted);
  font: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}
[data-table-filter-chip-clear]:hover {
  background: var(--bg-surface);
  color: var(--fg-default);
}

/* ── Row 分割线（CHG-UI-05 显式落地；arch-reviewer C-3 约束 row hover/selected 仍走 inline） ─────── *
 * 行分割线 + 最后一行 reset，避免与 foot/bulk 顶边重线；hover/selected 仍由 data-table.tsx
 * rowStyle 内联控制（var(--bg-surface-row) / var(--admin-accent-soft)）。 */
[data-table] [role="rowgroup"] [role="row"] {
  border-bottom: 1px solid var(--border-default);
}
[data-table] [role="rowgroup"] [role="row"]:last-child {
  border-bottom: none;
}

/* ── Row flash 动画（乐观更新场景；CHG-DESIGN-02 Step 5 flashRowKeys 配套） ─────── */
@keyframes admin-ui-dt-flash {
  0%   { background: color-mix(in oklch, var(--admin-accent-soft) 100%, transparent); }
  100% { background: transparent; }
}
[data-table] [role="row"][data-flash="true"] {
  animation: admin-ui-dt-flash 1.5s ease-out;
}
@media (prefers-reduced-motion: reduce) {
  [data-table] [role="row"][data-flash="true"] { animation: none; }
}

/* ── Bulk action bar（CHG-DESIGN-02 Step 5 + 7B fix#3，设计稿 .dt__bulk）─────── *
 * fix#3：bulk bar 作 frame 直接子层 flex slot（不在 scrollport 内 sticky）；
 * selection 非空时显示，与 foot 一同永驻 frame 内底部不被 long table content 埋没。 */
[data-table-bulk] {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  background: var(--bg-surface-elevated);
  border-top: 1px solid var(--accent-default);
  font-size: 12px;
  flex-shrink: 0;
  min-width: 0;
}
[data-table-bulk-count] {
  color: var(--fg-default);
  font-weight: 500;
}
[data-table-bulk-count] em {
  color: var(--admin-accent-on-soft);
  font-style: normal;
  font-weight: 700;
}
[data-table-bulk-sep] {
  width: 1px;
  height: 18px;
  background: var(--border-strong);
}
[data-table-bulk-actions] {
  display: flex;
  align-items: center;
  gap: 8px;
}
[data-table-bulk-clear] {
  background: transparent;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  color: var(--fg-muted);
  padding: 3px 10px;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
[data-table-bulk-clear]:hover {
  color: var(--fg-default);
  border-color: var(--border-strong);
}

/* ── DataTable foot pagination（CHG-DESIGN-02 Step 7A，设计稿 .dt__foot / .dt__pager）─────── */
[data-table-foot] {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  border-top: 1px solid var(--border-default);
  background: var(--bg-surface-elevated);
  font-size: 12px;
  color: var(--fg-muted);
  flex-shrink: 0;
}
[data-table-foot-summary] {
  flex: 0 0 auto;
}
[data-table-foot-pagesize] {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
[data-table-foot-pagesize-label] {
  color: var(--fg-muted);
}
[data-table-foot-pagesize] select {
  height: var(--row-h-compact, 24px);
  padding: 0 6px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  color: var(--fg-default);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
[data-table-foot-pagesize] select:hover {
  border-color: var(--border-strong);
}
[data-table-foot-pager] {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}
[data-table-foot-pager-btn] {
  min-width: var(--row-h-compact, 24px);
  height: var(--row-h-compact, 24px);
  padding: 0 6px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--fg-muted);
  font: inherit;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
}
[data-table-foot-pager-btn]:hover:not(:disabled):not([data-active="true"]) {
  background: var(--bg-surface-row);
  color: var(--fg-default);
}
[data-table-foot-pager-btn][data-active="true"] {
  background: var(--admin-accent-soft);
  color: var(--admin-accent-on-soft);
  border-color: var(--admin-accent-border);
  cursor: default;
}
[data-table-foot-pager-btn]:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
[data-table-foot-pager-ellipsis] {
  padding: 0 4px;
  color: var(--fg-muted);
  user-select: none;
}
` as const

let injected = false

/**
 * 一次性注入 DataTable 全局 CSS。
 * 多个 DataTable 实例同时挂载时仅写入一次（模块级 flag 守卫）。
 * 卸载时不撤回 — 卸载后样式残留无副作用，重新挂载可立即生效。
 */
export function DTStyles(): null {
  useEffect(() => {
    if (injected) return
    if (typeof document === 'undefined') return
    if (document.getElementById(STYLE_ID)) {
      injected = true
      return
    }
    const el = document.createElement('style')
    el.id = STYLE_ID
    el.textContent = DT_CSS
    document.head.appendChild(el)
    injected = true
  }, [])
  return null
}
