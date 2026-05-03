import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LoadingState } from '@resovo/admin-ui'
import { ModerationConsole } from './_client/ModerationConsole'

export const metadata: Metadata = {
  title: '内容审核台 | Resovo Admin',
}

export default function ModerationPage() {
  return (
    <Suspense fallback={<LoadingState variant="skeleton" />}>
      <ModerationConsole />
    </Suspense>
  )
}
