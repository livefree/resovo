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
import { DT_CSS_BASE } from './dt-styles-base'
import { DT_CSS_MATRIX } from './dt-styles-matrix'

const STYLE_ID = 'admin-ui-dt-styles'

const DT_CSS = DT_CSS_BASE + DT_CSS_MATRIX

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
