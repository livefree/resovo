/**
 * /admin/dev/design-tokens — Design Token 预览/编辑（迁移自 apps/server `/admin/design-tokens`）
 * CHG-CUTOVER-QA-DEV-MIGRATE：cutover 前迁入 server-next dev 工具区。
 *
 * 生产守卫：与 dev/visual 一致，production → notFound（隐藏 dev/QA 工具）。
 * API `/admin/design-tokens/*` 在 apps/api 共享后端，经 apiClient 调用。
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DesignTokensView } from './_components/DesignTokensView'

export const metadata: Metadata = { title: '设计 Token — 管理后台（dev）' }

const WEB_BASE_URL = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3002'

const PAGE_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  minHeight: 'calc(100vh - 140px)',
  padding: 24,
}

export default function DesignTokensPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <div style={PAGE_STYLE} data-testid="design-tokens-page">
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--fg-default)' }}>
          设计 Token
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', marginTop: 2, color: 'var(--fg-muted)' }}>
          管理 Brand Token 覆写。本里程碑为只读预览；编辑功能在 dev 环境开放（生产 API 403）。
        </p>
      </div>
      <DesignTokensView webBaseUrl={WEB_BASE_URL} />
    </div>
  )
}
