/**
 * dt-styles-matrix.ts — ColumnMatrixMenu + DataTableAutoFilter popover CSS（DTR-A 拆自 dt-styles.tsx）
 *
 * 范围：[data-column-matrix-menu] 矩阵 popover + [data-autofilter-popover] 自动过滤 popover。
 * 注入：由 dt-styles.tsx 单一 DTStyles 守卫统一拼接注入（本文件不自注入）。
 */
export const DT_CSS_MATRIX = `/* ── ColumnMatrixMenu（ADR-149 D-149-2/5/6/7/12） ─────── *
 * 统一矩阵 popover：列 × [可见性/过滤/排序] grid + 不支持灰化 + a11y switch/radiogroup */
[data-column-matrix-menu] {
  font-size: var(--font-size-sm-tight);
  color: var(--fg-default);
  font-family: inherit;
}
[data-column-matrix-grid] {
  width: 100%;
  border-collapse: collapse;
}
[data-column-matrix-grid] thead th {
  position: sticky;
  top: 0;
  background: var(--bg-surface-elevated);
  z-index: 1;
  padding: 6px 14px;
  text-align: left;
  font-size: var(--font-size-xxs);
  font-weight: 600;
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--border-default);
}
[data-column-matrix-grid] tbody th[scope="row"] {
  padding: 8px 14px;
  text-align: left;
  font-weight: 500;
  color: var(--fg-default);
  white-space: nowrap;
  min-width: 140px;
}
[data-column-matrix-grid] tbody td {
  padding: 8px 14px;
  vertical-align: middle;
}
[data-column-matrix-grid] tbody tr {
  border-bottom: 1px solid var(--border-subtle);
}
[data-column-matrix-grid] tbody tr:last-child {
  border-bottom: none;
}

/* switch toggle（可见性 / 过滤 格内通用） */
[data-column-matrix-menu] [role="switch"] {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  min-width: 40px;
  padding: 0 8px;
  border: 1px solid var(--border-default);
  border-radius: 999px;
  background: var(--bg-surface);
  color: var(--fg-muted);
  font: inherit;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition: color var(--duration-fast) var(--easing-ease-out),
              background var(--duration-fast) var(--easing-ease-out),
              border-color var(--duration-fast) var(--easing-ease-out);
}
[data-column-matrix-menu] [role="switch"][aria-checked="true"] {
  background: var(--admin-accent-soft);
  color: var(--admin-accent-on-soft);
  border-color: var(--admin-accent-border);
}
[data-column-matrix-menu] [role="switch"]:hover:not([disabled]):not([aria-disabled="true"]) {
  border-color: var(--border-strong);
}
[data-column-matrix-menu] [role="switch"][disabled],
[data-column-matrix-menu] [role="switch"][aria-disabled="true"] {
  opacity: 0.45;
  cursor: not-allowed;
}

/* radiogroup（排序 ↑↓× 三按钮） */
[data-column-matrix-menu] [role="radiogroup"] {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
[data-column-matrix-menu] [role="radiogroup"] button,
[data-column-matrix-menu] [role="radiogroup"] [role="radio"] {
  min-width: 24px;
  height: 22px;
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
[data-column-matrix-menu] [role="radiogroup"] [role="radio"]:hover:not([aria-checked="true"]) {
  background: var(--bg-surface-row);
  color: var(--fg-default);
}
[data-column-matrix-menu] [role="radiogroup"] [role="radio"][aria-checked="true"] {
  background: var(--admin-accent-soft);
  color: var(--admin-accent-on-soft);
  border-color: var(--admin-accent-border);
}
[data-column-matrix-menu] [role="radiogroup"] button[disabled] {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 不支持项灰化（pinned 可见性 / 无 filterContent 过滤 / 无 enableSorting 排序） */
[data-column-matrix-menu] [data-locked="true"],
[data-column-matrix-menu] [data-unsupported="true"] {
  color: var(--fg-muted);
  opacity: 0.6;
  user-select: none;
}

/* 过滤格摘要文本溢出处理（D-149-6 / max-width 200px + ellipsis + tooltip） */
[data-column-matrix-menu] [data-matrix-filter-cell="true"] {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
[data-column-matrix-menu] [data-matrix-filter-summary="true"] {
  display: inline-block;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--fg-muted);
  font-size: 12px;
}
@media (prefers-reduced-motion: reduce) {
  [data-column-matrix-menu] [role="switch"] { transition: none; }
}

/* ADR-150 阶段 2 / DataTableAutoFilter Google Sheets 简化布局
 * sub 1 HOTFIX 2026-05-24（@livefree 走读 6 类反馈）：
 *   - popover 固定 width:320 / max-height:480（去 min/max 区间 + 收窄上限）
 *   - section padding 8/12 → 10/14（更宽松）+ gap 4 → 6
 *   - section-divider 颜色 --border-subtle → --border-default（视觉根区分更强）
 *   - value-list max-height 280 → 240（弹窗不过大 / 多项时滚动条可见）
 *   - actions 区按钮 padding 6/14 → 6/12（防溢出）
 *   - 删除 [data-kind-radio]* 全部规则（kind radio section 已被组件删除） */
[data-autofilter-popover] {
  width: 320px;
  max-height: 480px;
  display: flex;
  flex-direction: column;
  font-size: 13px;
  color: var(--fg-default);
}
[data-autofilter-popover] [data-section] {
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
[data-autofilter-popover] [data-section-divider] {
  height: 1px;
  background: var(--border-default);
  margin: 0;
}
[data-autofilter-popover] [data-section="sort"] button,
[data-autofilter-popover] [data-section="hide"] button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: none;
  background: transparent;
  color: var(--fg-default);
  cursor: pointer;
  border-radius: 4px;
  text-align: left;
  font-size: 13px;
  font-family: inherit;
}
[data-autofilter-popover] [data-section="sort"] button:hover:not(:disabled),
[data-autofilter-popover] [data-section="hide"] button:hover {
  background: var(--bg-surface-row);
}
[data-autofilter-popover] [data-section="sort"] button[data-active="true"] {
  background: var(--admin-accent-soft);
  color: var(--admin-accent-on-soft);
}
[data-autofilter-popover] [data-section="sort"] button:disabled,
[data-autofilter-popover] [data-section="sort"] button[aria-disabled="true"] {
  opacity: 0.45;
  cursor: not-allowed;
  color: var(--fg-muted);
}
[data-autofilter-popover] [data-section="value"] {
  flex: 1 1 auto;
  min-height: 0;
}
[data-autofilter-popover] [data-search-box] input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--border-default);
  border-radius: 4px;
  font-size: 12px;
  background: var(--bg-surface);
  color: var(--fg-default);
  font-family: inherit;
}
[data-autofilter-popover] [data-actions-row] {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
[data-autofilter-popover] [data-actions-row] button {
  font-size: 11px;
  padding: 2px 6px;
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: 3px;
  color: var(--fg-muted);
  cursor: pointer;
  font-family: inherit;
}
[data-autofilter-popover] [data-status] {
  font-size: 11px;
  color: var(--fg-muted);
  padding: 4px 0;
}
[data-autofilter-popover] [data-status][data-error="true"] {
  color: var(--state-error-fg);
}
[data-autofilter-popover] [data-value-list] {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
}
[data-autofilter-popover] [data-value-list] li {
  padding: 0;
}
[data-autofilter-popover] [data-value-list] li label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 12px;
}
[data-autofilter-popover] [data-value-list] li label:hover {
  background: var(--bg-surface-row);
}
[data-autofilter-popover] [data-value-list] [data-count] {
  color: var(--fg-muted);
  font-size: 11px;
}
[data-autofilter-popover] [data-count-tail] {
  font-size: 11px;
  color: var(--fg-muted);
  margin-top: 4px;
}
[data-autofilter-popover] [data-text-input] {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--border-default);
  border-radius: 4px;
  background: var(--bg-surface);
  color: var(--fg-default);
  font-size: 13px;
  font-family: inherit;
}
[data-autofilter-popover] [data-number-range],
[data-autofilter-popover] [data-date-range] {
  display: flex;
  align-items: center;
  gap: 6px;
}
[data-autofilter-popover] [data-number-range] input,
[data-autofilter-popover] [data-date-range] input {
  flex: 1 1 0;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid var(--border-default);
  border-radius: 4px;
  font-size: 12px;
  background: var(--bg-surface);
  color: var(--fg-default);
  font-family: inherit;
}
[data-autofilter-popover] [data-actions] {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--border-default);
  background: var(--bg-surface);
  flex-shrink: 0;
}
[data-autofilter-popover] [data-actions] [data-actions-spacer] {
  flex: 1 1 auto;
}
[data-autofilter-popover] [data-actions] button {
  padding: 6px 12px;
  border: 1px solid var(--border-default);
  border-radius: 4px;
  background: var(--bg-surface);
  color: var(--fg-default);
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  flex-shrink: 0;
}
[data-autofilter-popover] [data-actions] button[data-primary="true"] {
  background: var(--admin-accent-soft);
  color: var(--admin-accent-on-soft);
  border-color: var(--admin-accent-soft);
}
[data-autofilter-popover] [data-actions] button:hover {
  background: var(--bg-surface-row);
}
[data-autofilter-popover] [data-actions] button[data-primary="true"]:hover {
  filter: brightness(1.05);
}
@media (prefers-reduced-motion: reduce) {
  [data-autofilter-popover] button { transition: none; }
}
` as const
