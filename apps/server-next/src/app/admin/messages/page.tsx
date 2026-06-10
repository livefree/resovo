import { Suspense } from 'react'
import type { Metadata } from 'next'
import { LoadingState } from '@resovo/admin-ui'
import { MessageCenterClient } from './_client/MessageCenterClient'

export const metadata: Metadata = {
  title: '消息中心 | Resovo Admin',
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<LoadingState variant="skeleton" />}>
      <MessageCenterClient />
    </Suspense>
  )
}
