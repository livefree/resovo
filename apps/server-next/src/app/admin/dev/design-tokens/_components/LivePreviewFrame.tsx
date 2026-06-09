'use client'

/**
 * LivePreviewFrame — 右下 token playground 实时预览。
 * 迁移自 apps/server（CHG-CUTOVER-QA-DEV-MIGRATE）：Tailwind 类转内联样式。
 */

import type { RefObject } from 'react'

interface LivePreviewFrameProps {
  selectedBrandSlug: string | null
  webBaseUrl: string
  iframeRef?: RefObject<HTMLIFrameElement | null>
}

const FRAME_STYLE: React.CSSProperties = {
  flex: '1 1 0%',
  width: '100%',
  height: '100%',
  border: 0,
}

export function LivePreviewFrame({ webBaseUrl, iframeRef }: LivePreviewFrameProps) {
  const src = `${webBaseUrl}/en/playground/tokens`

  return (
    <iframe
      ref={iframeRef}
      src={src}
      title="Token Playground Preview"
      style={FRAME_STYLE}
      data-testid="token-preview-frame"
    />
  )
}
