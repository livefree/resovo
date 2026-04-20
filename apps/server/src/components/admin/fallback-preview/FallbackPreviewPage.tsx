'use client'

import { useState } from 'react'

const ASPECTS = ['2:3', '16:9', '1:1', '5:6'] as const
const VIDEO_TYPES = ['movie', 'series', 'anime', 'variety', 'documentary'] as const

type VideoType = typeof VIDEO_TYPES[number]

const TYPE_LABELS: Record<VideoType, string> = {
  movie:       '电影',
  series:      '剧集',
  anime:       '动漫',
  variety:     '综艺',
  documentary: '纪录片',
}

const ASPECT_STYLE: Record<string, { paddingTop: string; width: string }> = {
  '2:3':  { paddingTop: '150%', width: '100px' },
  '16:9': { paddingTop: '56.25%', width: '160px' },
  '1:1':  { paddingTop: '100%', width: '100px' },
  '5:6':  { paddingTop: '120%', width: '100px' },
}

function djb2(seed: string): number {
  let h = 5381
  for (let i = 0; i < seed.length; i++) {
    h = (((h << 5) + h) ^ seed.charCodeAt(i)) >>> 0
  }
  return h
}

interface FallbackPreviewItemProps {
  aspect: string
  type: VideoType
}

function FallbackPreviewItem({ aspect, type }: FallbackPreviewItemProps) {
  const seed = `${type}-${aspect}`
  const gradientIdx = djb2(seed) % 6
  const { paddingTop, width } = ASPECT_STYLE[aspect] ?? { paddingTop: '150%', width: '100px' }

  return (
    <div
      className="rounded-lg overflow-hidden border shrink-0 text-xs"
      style={{
        width,
        borderColor: 'var(--border)',
      }}
    >
      <div
        className="relative w-full"
        style={{
          paddingTop,
          background: `var(--fallback-gradient-${gradientIdx})`,
        }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2">
          <svg
            xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="1.5"
            style={{ color: 'var(--muted)' }}
            aria-hidden
          >
            <rect x="2" y="2" width="20" height="20" rx="2" />
            <path d="M2 7h20M7 2v5" />
          </svg>
          <span
            className="px-1 py-0.5 rounded font-bold"
            style={{
              fontSize: 10,
              background: 'var(--accent)',
              color: 'var(--accent-foreground)',
            }}
          >
            {TYPE_LABELS[type]}
          </span>
        </div>
        <div
          className="absolute bottom-0 inset-x-0 px-1.5 py-1 text-center leading-tight"
          style={{
            background: 'var(--modal-overlay)',
            color: 'var(--secondary-foreground)',
            fontSize: 10,
          }}
        >
          {aspect}
        </div>
      </div>
    </div>
  )
}

function PreviewGrid({ label }: { label: string }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
        {label}
      </h3>
      {ASPECTS.map((aspect) => (
        <div key={aspect} className="space-y-2">
          <p className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
            {aspect} 比例
          </p>
          <div className="flex flex-wrap gap-3">
            {VIDEO_TYPES.map((type) => (
              <FallbackPreviewItem key={`${aspect}-${type}`} aspect={aspect} type={type} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function FallbackPreviewPage() {
  const [showDark, setShowDark] = useState(false)

  return (
    <div className="space-y-6" data-testid="fallback-preview-page">
      <div className="flex items-center gap-4">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          共 {ASPECTS.length} 种比例 × {VIDEO_TYPES.length} 种类型 = {ASPECTS.length * VIDEO_TYPES.length} 格。
          当前使用管理台 CSS 变量近似预览前台渐变效果。
        </p>
        <button
          onClick={() => setShowDark((v) => !v)}
          className="text-xs px-3 py-1.5 rounded border transition-colors hover:opacity-80"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--text)',
            background: 'var(--bg2)',
          }}
        >
          {showDark ? '切换浅色' : '切换深色'}
        </button>
      </div>

      <div
        className="rounded-xl p-4"
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          colorScheme: showDark ? 'dark' : 'light',
        }}
      >
        <PreviewGrid label={showDark ? '深色主题预览' : '浅色主题预览'} />
      </div>
    </div>
  )
}
