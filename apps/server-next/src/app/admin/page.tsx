import { Suspense } from 'react'
import type { Metadata } from 'next'
import { LoadingState } from '@resovo/admin-ui'
import { DashboardClient } from './_client/DashboardClient'

export const metadata: Metadata = { title: '概览 | Resovo Admin' }

export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingState variant="skeleton" />}>
      <DashboardClient />
    </Suspense>
  )
}
