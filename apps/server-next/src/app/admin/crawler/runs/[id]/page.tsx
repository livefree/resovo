import { Suspense } from 'react'
import type { Metadata } from 'next'
import { LoadingState } from '@resovo/admin-ui'
import { CrawlerRunDetailView } from './_client/CrawlerRunDetailView'

export const metadata: Metadata = {
  title: '批次详情 | Resovo Admin',
}

interface PageProps {
  readonly params: Promise<{ readonly id: string }>
}

export default async function CrawlerRunDetailPage({ params }: PageProps) {
  const { id } = await params
  return (
    <Suspense fallback={<LoadingState variant="skeleton" />}>
      <CrawlerRunDetailView runId={id} />
    </Suspense>
  )
}
