/**
 * dt-styles-resize.ts — DataTable 列宽可调 CSS（DTR-B / SEQ-20260531-01）
 *
 * 范围：表头列名之间的拖拽分割线 [data-dt-resize-handle] / drag 期全局光标 +
 *       禁选 [data-dt-resizing] / 截断悬浮 [data-dt-truncate]。
 * 注入：由 dt-styles.tsx 单一 DTStyles 守卫统一拼接注入（base + matrix + 本模块）。
 *
 * 颜色零硬编码（全 CSS 变量）；`prefers-reduced-motion` 关过渡（plan §5）。
 * 仅在 `enableColumnResizing===true` 路径渲染上述 DOM，故 legacy 表格不受影响。
 */
export const DT_CSS_RESIZE = `
/* ── 列宽拖拽分割线（需求 (2)：仅表头列名之间）─────── *
 * 绝对定位贴 th 右缘（th 在 enable 路径加 position:relative）；th overflow:hidden 限制下
 * 命中区落在右 padding 区内（不与列名 / 排序图标 / ⋯ 按钮重叠）。可视 1px 线落在列边界。 */
[data-table] [data-dt-resize-handle] {
  position: absolute;
  top: 0;
  right: 0;
  width: 8px;
  height: 100%;
  z-index: 2;
  background: transparent;
  cursor: col-resize;
  /* Pointer 拖拽不触发触屏滚动 / 文本选区 */
  touch-action: none;
  user-select: none;
}
[data-table] [data-dt-resize-handle]::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 1px;
  height: 100%;
  background: var(--border-default);
  transition: background var(--duration-fast) var(--easing-ease-out);
}
[data-table] [data-dt-resize-handle]:hover::after {
  background: var(--border-strong);
}
[data-table] [data-dt-resize-handle]:active::after,
[data-table] [data-dt-resize-handle]:focus-visible::after {
  background: var(--admin-accent-border);
  width: 2px;
}
[data-table] [data-dt-resize-handle]:focus-visible {
  /* 焦点态用分割线加粗 + accent 表达，不画外框破坏 sticky 表头视觉 */
  outline: none;
}
@media (prefers-reduced-motion: reduce) {
  [data-table] [data-dt-resize-handle]::after { transition: none; }
}

/* ── drag 期：全局 col-resize 光标 + 禁选（挂 body[data-dt-resizing]）─────── */
[data-dt-resizing],
[data-dt-resizing] * {
  cursor: col-resize !important;
  user-select: none !important;
}

/* ── 截断 + native title 悬浮（需求 (4)：行高不变）─────── *
 * 仅 enable 路径的默认字符串 cell / 表头 label 包 [data-dt-truncate]；flex:1 + min-width:0
 * 让其在 flex cell 内可收缩到 ellipsis，nowrap + 固定 row-height 保证不换行不变高。 */
[data-table] [data-dt-truncate] {
  display: block;
  flex: 1;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

` as const
