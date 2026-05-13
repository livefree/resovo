import { Suspense } from 'react'
import type { Metadata } from 'next'
import { LoadingState } from '@resovo/admin-ui'
import { SubmissionsListClient } from './_client/SubmissionsListClient'

export const metadata: Metadata = {
  title: '用户投稿 | Resovo Admin',
}

export default function SubmissionsPage() {
  return (
    <Suspense fallback={<LoadingState variant="skeleton" />}>
      <SubmissionsListClient />
    </Suspense>
  )
}
