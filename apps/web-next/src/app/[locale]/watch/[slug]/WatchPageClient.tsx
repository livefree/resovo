'use client'

import { useWatchSlugSync } from './_hooks/use-watch-slug-sync'
import { ConfirmReplaceDialog } from '@/components/player/ConfirmReplaceDialog'

interface WatchPageClientProps {
  slug: string
}

export function WatchPageClient({ slug }: WatchPageClientProps) {
  const { needsConfirm, confirm, cancel } = useWatchSlugSync(slug)

  return (
    <>
      {needsConfirm && (
        <ConfirmReplaceDialog onConfirm={confirm} onCancel={cancel} />
      )}
    </>
  )
}
