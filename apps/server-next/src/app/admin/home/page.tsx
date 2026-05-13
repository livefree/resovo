import { Suspense } from 'react'
import type { Metadata } from 'next'
import { LoadingState } from '@resovo/admin-ui'
import { HomeOpsClient } from './_client/HomeOpsClient'

export const metadata: Metadata = {
  title: '首页运营位 | Resovo Admin',
}

export default function HomeOpsPage() {
  return (
    <Suspense fallback={<LoadingState variant="skeleton" />}>
      <HomeOpsClient />
    </Suspense>
  )
}
