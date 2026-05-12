'use client'

/**
 * /admin/dev/visual/[component] — 动态分发：从 registry 取注册项渲染
 * 真源：ADR-116 §2.2 / §2.4（CHG-SN-5-PRE-01-E-1）
 *
 * URL：/admin/dev/visual/<component-id>?state=<slug>
 * 默认 state：第一个 registry.states[0].slug
 *
 * 双层生产守卫第 2 层：单页防御性兜底（layout 已第 1 层，此处保险）。
 *
 * **followup-8（RSC 边界修订）**：必须是 Client Component — 5 件组件中 StaffNoteBar /
 * LineHealthDrawer / RejectModal 接收 onClose / onSubmit / onEdit 等 handler props，
 * registry render() 会注入 noop handlers；这些 handler 不可序列化跨 server→client 边界，
 * 必须在 client 端执行 render()。React 19 用 `use()` 解 promise params/searchParams。
 */

import { use } from 'react'
import { notFound } from 'next/navigation'
import { getEntry } from '../_lib/component-registry'

interface PageProps {
  readonly params: Promise<{ component: string }>
  readonly searchParams: Promise<{ state?: string }>
}

const HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 16,
  marginBottom: 24,
  paddingBottom: 16,
  borderBottom: '1px solid var(--border-subtle)',
}

const TITLE_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-lg)',
  fontWeight: 600,
  color: 'var(--fg-default)',
}

const STATE_BADGE: React.CSSProperties = {
  padding: '2px 8px',
  background: 'var(--admin-accent-soft)',
  color: 'var(--admin-accent-on-soft)',
  border: '1px solid var(--admin-accent-border)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--font-size-sm-tight)',
  fontFamily: 'var(--font-family-mono)',
}

const DEMO_AREA_STYLE: React.CSSProperties = {
  padding: 32,
  background: 'var(--bg-surface-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  minHeight: 200,
}

export default function VisualComponentPage({ params, searchParams }: PageProps) {
  if (process.env.NODE_ENV === 'production') notFound()

  const { component } = use(params)
  const { state: stateParam } = use(searchParams)

  const entry = getEntry(component)
  if (!entry) notFound()

  // 默认取第一个 state；URL 显式 state 优先
  const stateSlug = stateParam ?? entry.states[0]?.slug ?? ''
  const stateEntry = entry.states.find((s) => s.slug === stateSlug)

  return (
    <div data-visual-component={component} data-state={stateSlug}>
      <div style={HEADER_STYLE}>
        <h1 style={TITLE_STYLE}>{entry.title}</h1>
        <span style={STATE_BADGE}>state={stateSlug || '(default)'}</span>
        {stateEntry ? (
          <span style={{ fontSize: 'var(--font-size-sm-tight)', color: 'var(--fg-muted)' }}>
            {stateEntry.label}
          </span>
        ) : null}
      </div>
      <div style={DEMO_AREA_STYLE} data-visual-demo-area>
        {entry.render(stateSlug)}
      </div>
    </div>
  )
}
