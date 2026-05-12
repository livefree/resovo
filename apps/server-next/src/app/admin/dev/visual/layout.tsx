/**
 * /admin/dev/visual — Playwright visual harness 路由组守卫 + demo 容器
 * 真源：ADR-116 §2.3（CHG-SN-5-PRE-01-E-1 / SEQ-20260506-02 / M-SN-5.5 A 段）
 *
 * 双层生产守卫第 1 层：layout 一次性拦截整个 dev/visual/* 子树。
 * 第 2 层在 [component]/page.tsx 内防御性兜底。
 *
 * middleware 现有 admin 鉴权（refresh_token + 非 user role）对本路由仍生效（第 3 重防御）。
 */

import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

const DEMO_CONTAINER_STYLE: React.CSSProperties = {
  background: 'var(--bg-surface)',
  minHeight: '100vh',
  padding: 24,
}

export default function VisualLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <div data-visual-demo style={DEMO_CONTAINER_STYLE}>
      {children}
    </div>
  )
}
