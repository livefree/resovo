/**
 * /admin/dev/design-tokens — Design Token 预览/编辑（迁移自 apps/server `/admin/design-tokens`）
 * CHG-CUTOVER-QA-DEV-MIGRATE：cutover 前迁入 server-next dev 工具区。
 *
 * 鉴权：由 middleware admin 鉴权（ADR-010）兜底——未登录 → /login，role==='user' → /403。
 * 与 dev/components 同范式（admin-only dev 工具）；**不**采用 dev/visual 的「middleware 豁免 +
 * NODE_ENV notFound」模型：dev/visual 因 Playwright 免登录抓图被 middleware 豁免，notFound 是其
 * 唯一守门；本路由未豁免，已有 middleware 鉴权，再加 NODE_ENV 守卫对未认证用户无效（middleware
 * 先 redirect），却会对已登录管理员在生产误 404（旧 apps/server 同页本可生产访问）。
 * 写回（PUT）由 apps/api 端 dev-only 403 守卫；生产环境 DiffPanel 走只读条（isProduction）。
 * API `/admin/design-tokens/*` 在 apps/api 共享后端，经 apiClient 调用。
 */

import type { Metadata } from 'next'
import { DesignTokensView } from './_components/DesignTokensView'

export const metadata: Metadata = { title: '设计 Token — 管理后台（dev）' }

const WEB_BASE_URL = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3002'
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

const PAGE_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  minHeight: 'calc(100vh - 140px)',
  padding: 24,
}

export default function DesignTokensPage() {
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
      <DesignTokensView webBaseUrl={WEB_BASE_URL} isProduction={IS_PRODUCTION} />
    </div>
  )
}
