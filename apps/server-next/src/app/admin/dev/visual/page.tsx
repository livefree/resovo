/**
 * /admin/dev/visual — 索引页：列出 5 件组件与各 state 入口
 * 真源：ADR-116 §2.2（CHG-SN-5-PRE-01-E-1）
 *
 * 与 /admin/dev/components（CHG-SN-2-19）分工：
 *   - dev/components：交互功能验收（手动浏览）
 *   - dev/visual：Playwright visual baseline（自动化截图 + 状态精细控制）
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { REGISTRY } from './_lib/component-registry'

export const metadata = { title: 'Admin UI Visual Harness' }

const HEADING_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-xl)',
  fontWeight: 600,
  color: 'var(--fg-default)',
  marginBottom: 8,
}

const HINT_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-sm-tight)',
  color: 'var(--fg-muted)',
  marginBottom: 24,
}

const COMPONENT_BLOCK: React.CSSProperties = {
  marginBottom: 32,
  padding: 16,
  background: 'var(--bg-surface-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
}

const COMPONENT_TITLE: React.CSSProperties = {
  fontSize: 'var(--font-size-base)',
  fontWeight: 600,
  color: 'var(--fg-default)',
  marginBottom: 8,
}

const STATE_LINK: React.CSSProperties = {
  display: 'inline-block',
  marginRight: 12,
  marginBottom: 6,
  padding: '4px 10px',
  background: 'var(--admin-accent-soft)',
  color: 'var(--admin-accent-on-soft)',
  border: '1px solid var(--admin-accent-border)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--font-size-sm-tight)',
  textDecoration: 'none',
}

export default function VisualIndexPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <div data-visual-index>
      <h1 style={HEADING_STYLE}>Admin UI Visual Harness</h1>
      <p style={HINT_STYLE}>
        Dev-only Playwright visual baseline 入口（ADR-116）。点击各 state 进入对应组件 demo 页面。
        Playwright spec 通过 URL query param 直接访问每个 state，跑 <code>--update-snapshots</code> 生成 baseline。
      </p>
      {REGISTRY.map((entry) => (
        <div key={entry.id} style={COMPONENT_BLOCK} data-component={entry.id}>
          <div style={COMPONENT_TITLE}>{entry.title}</div>
          <div>
            {entry.states.map((state) => (
              <Link
                key={state.slug}
                href={`/admin/dev/visual/${entry.id}?state=${state.slug}`}
                style={STATE_LINK}
                data-state={state.slug}
              >
                {state.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
