import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LoadingState } from '@resovo/admin-ui'
import { StagingPageClient } from './_client/StagingPageClient'

export const metadata: Metadata = {
  title: '暂存发布 | Resovo Admin',
}

export default function StagingPage() {
  return (
    <Suspense fallback={<LoadingState variant="skeleton" />}>
      <StagingPageClient />
    </Suspense>
  )
}
