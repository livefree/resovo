/**
 * /admin/design-tokens — Design Token 管理（只读预览 MVP）
 * TOKEN-14: 左侧 Brand 列表 + 右侧 Token Playground iframe
 */

import { DesignTokensView } from '@/components/admin/design-tokens/DesignTokensView'

export const metadata = { title: '设计 Token — 管理后台' }

const WEB_BASE_URL = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3002'

export default function DesignTokensPage() {
  return (
    <div className="flex flex-col h-full gap-0" data-testid="design-tokens-page">
      <div className="mb-4 px-0">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
          设计 Token
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
          管理 Brand Token 覆写。本里程碑为只读预览；编辑功能在 M5+ 开放。
        </p>
      </div>
      <DesignTokensView webBaseUrl={WEB_BASE_URL} />
    </div>
  )
}
