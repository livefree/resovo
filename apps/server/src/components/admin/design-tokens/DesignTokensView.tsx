'use client'

import { useState } from 'react'
import { TokenTable } from './TokenTable'
import { LivePreviewFrame } from './LivePreviewFrame'

interface DesignTokensViewProps {
  webBaseUrl: string
}

export function DesignTokensView({ webBaseUrl }: DesignTokensViewProps) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)

  return (
    <div
      className="flex flex-1 gap-0 border rounded overflow-hidden"
      style={{ borderColor: 'var(--border)', minHeight: '600px' }}
    >
      <div
        className="w-[420px] shrink-0 overflow-y-auto border-r p-4"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}
      >
        <TokenTable onBrandSelect={setSelectedSlug} selectedSlug={selectedSlug} />
      </div>

      <div
        className="flex-1 flex overflow-hidden"
        style={{ backgroundColor: 'var(--bg2)' }}
      >
        <LivePreviewFrame selectedBrandSlug={selectedSlug} webBaseUrl={webBaseUrl} />
      </div>
    </div>
  )
}
