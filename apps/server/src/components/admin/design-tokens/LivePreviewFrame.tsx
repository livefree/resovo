'use client'

import type { RefObject } from 'react'

interface LivePreviewFrameProps {
  selectedBrandSlug: string | null
  webBaseUrl: string
  iframeRef?: RefObject<HTMLIFrameElement | null>
}

export function LivePreviewFrame({ webBaseUrl, iframeRef }: LivePreviewFrameProps) {
  const src = `${webBaseUrl}/en/playground/tokens`

  return (
    <iframe
      ref={iframeRef}
      src={src}
      title="Token Playground Preview"
      className="flex-1 w-full border-0 h-full"
      data-testid="token-preview-frame"
    />
  )
}
