import { Suspense } from 'react'
import type { Metadata } from 'next'
import { LoadingState } from '@resovo/admin-ui'
import { AuditClient } from './_client/AuditClient'

export const metadata: Metadata = {
  title: '审计日志 | Resovo Admin',
}

export default function AuditPage() {
  return (
    <Suspense fallback={<LoadingState variant="skeleton" />}>
      <AuditClient />
    </Suspense>
  )
}
