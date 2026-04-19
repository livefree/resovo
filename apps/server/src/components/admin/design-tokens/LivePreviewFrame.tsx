'use client'

import { useEffect, useRef } from 'react'

interface LivePreviewFrameProps {
  selectedBrandSlug: string | null
  webBaseUrl: string
}

export function LivePreviewFrame({ selectedBrandSlug, webBaseUrl }: LivePreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const src = selectedBrandSlug
    ? `${webBaseUrl}/zh/__playground/tokens`
    : `${webBaseUrl}/zh/__playground/tokens`

  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.src = src
    }
  }, [src])

  if (!selectedBrandSlug) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--fg-muted)' }}
      >
        <p className="text-sm">选择左侧 Brand 以预览 Token</p>
      </div>
    )
  }

  return (
    <iframe
      ref={iframeRef}
      src={src}
      title="Token Playground Preview"
      className="flex-1 w-full border-0"
      style={{ minHeight: '600px' }}
      data-testid="token-preview-frame"
    />
  )
}
