import { Suspense } from 'react'
import type { Metadata } from 'next'
import { LoadingState } from '@resovo/admin-ui'
import { SourcesClient } from './_client/SourcesClient'

export const metadata: Metadata = {
  title: '播放线路 | Resovo Admin',
}

export default function SourcesPage() {
  return (
    <Suspense fallback={<LoadingState variant="skeleton" />}>
      <SourcesClient />
    </Suspense>
  )
}
