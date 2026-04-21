'use client'

const FRONTEND_URL =
  process.env['NEXT_PUBLIC_FRONTEND_URL'] ??
  process.env['NEXT_PUBLIC_WEB_URL'] ??
  'http://localhost:3000'

const PREVIEW_PATH = '/en/__dev/fallback-preview'

export function FallbackPreviewPage() {
  const previewUrl = `${FRONTEND_URL.replace(/\/$/, '')}${PREVIEW_PATH}`

  return (
    <div className="space-y-3" data-testid="fallback-preview-page">
      <div className="flex items-center gap-3">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          由前台站点渲染真实 FallbackCover + BrandSwitcher，共 40 格（4 比例 × 5 类型 × 浅色/深色）。
        </p>
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs px-3 py-1.5 rounded border transition-colors hover:opacity-80"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--text)',
            background: 'var(--bg2)',
          }}
        >
          新标签打开 ↗
        </a>
      </div>

      <iframe
        src={previewUrl}
        title="FallbackCover Preview（前台真实渲染）"
        className="w-full rounded-lg border"
        style={{
          height: 'calc(100vh - 220px)',
          minHeight: 600,
          borderColor: 'var(--border)',
        }}
        loading="lazy"
      />
    </div>
  )
}
