'use client'

interface LivePreviewFrameProps {
  selectedBrandSlug: string | null
  webBaseUrl: string
}

export function LivePreviewFrame({ webBaseUrl }: LivePreviewFrameProps) {
  const src = `${webBaseUrl}/en/playground/tokens`

  return (
    <iframe
      src={src}
      title="Token Playground Preview"
      className="flex-1 w-full border-0"
      style={{ minHeight: '600px' }}
      data-testid="token-preview-frame"
    />
  )
}
