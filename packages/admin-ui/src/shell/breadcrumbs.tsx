'use client'

/**
 * breadcrumbs.tsx — 面包屑组件 + inferBreadcrumbs helper（ADR-103a §4.1.9）
 *
 * 真源（按优先级）：
 *   - ADR-103a §4.1.9 Breadcrumbs + inferBreadcrumbs
 *   - ADR-103a §4.4 4 项硬约束（Provider 不下沉 / Edge Runtime 兼容 / 零硬编码颜色 / 零图标库依赖）
 *   - ADR-100 IA 修订段 v1（5 组结构 + hidden 路由策略）
 *
 * 设计要点：
 *   - Breadcrumbs：纯渲染组件，按 items 数组渲染节点序列
 *     · 最后一项 <strong> 加粗（active 项）
 *     · 中间项有 href 时点击触发 onItemClick；无 href 项纯文本不响应点击
 *     · 分隔符默认 " / "（设计稿 v2.1 shell.jsx Topbar 实践一致）
 *   - inferBreadcrumbs：纯函数 helper，从 ADMIN_NAV 5 组结构 + activeHref 推断 BreadcrumbItem[]
 *     · 找到 → 返 [{ label: section.title }, { label: item.label, href: item.href }]
 *     · 未找到（hidden 路由 / 不存在路径）→ 返 []（消费方 AdminShellProps.crumbs 注入 undefined 时
 *       Topbar 不渲染面包屑，与 ADR-103a §4.1.1 P2-B 修订一致）
 *
 * 不做：
 *   - 不实现可点击跳转的默认行为（消费方传 onItemClick 才响应；ADR §4.1.9 "默认纯文本"）
 *   - 不读 next/navigation 路由状态（与 ADR §4.1.1 AdminShell "不持有路由状态"边界一致）
 *   - 不支持 children 嵌套二级面包屑（M-SN-2 admin-nav.tsx 当前未启用 children；未来 M-SN-3
 *     系统设置容器化后视需求扩展）
 *
 * 跨域消费：本文件被 packages/admin-ui Shell 内部消费 + server-next 应用层 AdminShell
 * 调用方使用 inferBreadcrumbs；不暴露到其他包。
 */
import type { CSSProperties } from 'react'
import type { AdminNavSection } from './types'

export interface BreadcrumbItem {
  readonly label: string
  readonly href?: string
}

export interface BreadcrumbsProps {
  readonly items: readonly BreadcrumbItem[]
  readonly onItemClick?: (item: BreadcrumbItem, index: number) => void
}

const SEPARATOR_STYLE: CSSProperties = {
  margin: '0 var(--space-2)',
  color: 'var(--fg-muted)',
}

const LINK_STYLE: CSSProperties = {
  background: 'transparent',
  border: 0,
  padding: 0,
  font: 'inherit',
  color: 'var(--fg-muted)',
  cursor: 'pointer',
  textDecoration: 'none',
}

const TEXT_STYLE: CSSProperties = {
  color: 'var(--fg-muted)',
}

const ACTIVE_STYLE: CSSProperties = {
  color: 'var(--fg-default)',
}

export function Breadcrumbs({ items, onItemClick }: BreadcrumbsProps) {
  if (items.length === 0) return null
  const lastIndex = items.length - 1
  return (
    <nav
      aria-label="面包屑"
      data-breadcrumbs
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 'var(--font-size-sm)',
      }}
    >
      {items.map((item, index) => {
        const isLast = index === lastIndex
        const isClickable = !isLast && item.href !== undefined && onItemClick !== undefined
        return (
          <span key={`${index}-${item.href ?? item.label}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {index > 0 && (
              <span aria-hidden="true" style={SEPARATOR_STYLE}>
                /
              </span>
            )}
            {isLast ? (
              <strong style={ACTIVE_STYLE}>{item.label}</strong>
            ) : isClickable ? (
              <button
                type="button"
                onClick={() => onItemClick?.(item, index)}
                style={LINK_STYLE}
                data-breadcrumb-index={index}
              >
                {item.label}
              </button>
            ) : (
              <span style={TEXT_STYLE} data-breadcrumb-index={index}>
                {item.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}

/** 从 ADMIN_NAV 5 组结构 + activeHref 推断 BreadcrumbItem[]
 *  - activeHref 完全匹配 nav 中某 item.href → 返 [{ label: section.title }, { label: item.label, href: item.href }]
 *  - 未找到（hidden 路由如 /admin/analytics / 不存在路径）→ 返 []
 *
 *  M-SN-2 admin-nav.tsx 当前不启用 children 嵌套；本函数遍历 children 仅作未来兼容（命中亦返
 *  [section.title, parent.label, child.label] 三段，递归一层）。 */
export function inferBreadcrumbs(
  activeHref: string,
  nav: readonly AdminNavSection[],
): readonly BreadcrumbItem[] {
  for (const section of nav) {
    for (const item of section.items) {
      if (item.href === activeHref) {
        return [{ label: section.title }, { label: item.label, href: item.href }]
      }
      if (item.children) {
        for (const child of item.children) {
          if (child.href === activeHref) {
            return [
              { label: section.title },
              { label: item.label, href: item.href },
              { label: child.label, href: child.href },
            ]
          }
        }
      }
    }
  }
  return []
}
