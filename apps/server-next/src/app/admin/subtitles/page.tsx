import { Suspense } from 'react'
import type { Metadata } from 'next'
import { LoadingState } from '@resovo/admin-ui'
import { SubtitlesListClient } from './_client/SubtitlesListClient'

export const metadata: Metadata = {
  title: '字幕审核 | Resovo Admin',
}

export default function SubtitlesPage() {
  return (
    <Suspense fallback={<LoadingState variant="skeleton" />}>
      <SubtitlesListClient />
    </Suspense>
  )
}
