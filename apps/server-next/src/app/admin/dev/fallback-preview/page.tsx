/**
 * /admin/dev/fallback-preview — FallbackCover 样板图预览（迁移自 apps/server `/admin/fallback-preview`）
 * CHG-CUTOVER-QA-DEV-MIGRATE：cutover 前迁入 server-next dev 工具区。
 *
 * 由前台站点渲染真实 FallbackCover + BrandSwitcher（前台路由 /en/dev/fallback-preview）。
 * 生产守卫：与 dev/visual 一致，production → notFound（隐藏 dev/QA 工具）。
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export const metadata: Metadata = { title: '样板图预览 — 管理后台（dev）' }

const WEB_BASE_URL = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3002'
const PREVIEW_PATH = '/en/dev/fallback-preview'

const LINK_STYLE: React.CSSProperties = {
  flexShrink: 0,
  fontSize: 'var(--font-size-xs)',
  padding: '6px 12px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-default)',
  color: 'var(--fg-default)',
  background: 'var(--bg-surface-raised)',
  textDecoration: 'none',
}

const FRAME_STYLE: React.CSSProperties = {
  width: '100%',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-default)',
  height: 'calc(100vh - 220px)',
  minHeight: 600,
}

export default function FallbackPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  const previewUrl = `${WEB_BASE_URL.replace(/\/$/, '')}${PREVIEW_PATH}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 24 }} data-testid="admin-fallback-preview-page">
      <div>
        <h1 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--fg-default)' }}>
          样板图预览
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', marginTop: 2, color: 'var(--fg-muted)' }}>
          预览不同比例、类型与主题下的 FallbackCover 渲染效果，确认颜色变量无硬编码。
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--fg-muted)' }}>
          由前台站点渲染真实 FallbackCover + BrandSwitcher，共 40 格（4 比例 × 5 类型 × 浅色/深色）。
        </p>
        <a href={previewUrl} target="_blank" rel="noopener noreferrer" style={LINK_STYLE}>
          新标签打开 ↗
        </a>
      </div>

      <iframe
        src={previewUrl}
        title="FallbackCover Preview（前台真实渲染）"
        style={FRAME_STYLE}
        loading="lazy"
      />
    </div>
  )
}
