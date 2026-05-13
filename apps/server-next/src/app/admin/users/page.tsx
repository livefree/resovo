import { Suspense } from 'react'
import type { Metadata } from 'next'
import { LoadingState } from '@resovo/admin-ui'
import { UsersListClient } from './_client/UsersListClient'

export const metadata: Metadata = {
  title: '用户管理 | Resovo Admin',
}

export default function UsersPage() {
  return (
    <Suspense fallback={<LoadingState variant="skeleton" />}>
      <UsersListClient />
    </Suspense>
  )
}
