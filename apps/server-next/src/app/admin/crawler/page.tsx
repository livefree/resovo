import { Suspense } from 'react'
import type { Metadata } from 'next'
import { LoadingState } from '@resovo/admin-ui'
import { CrawlerClient } from './_client/CrawlerClient'

export const metadata: Metadata = {
  title: '采集控制 | Resovo Admin',
}

export default function CrawlerPage() {
  return (
    <Suspense fallback={<LoadingState variant="skeleton" />}>
      <CrawlerClient />
    </Suspense>
  )
}
