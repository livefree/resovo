import { Suspense } from 'react'
import type { Metadata } from 'next'
import { LoadingState } from '@resovo/admin-ui'
import { SettingsContainer } from './_client/SettingsContainer'

export const metadata: Metadata = { title: '系统设置 | Resovo Admin' }

export default function SystemSettingsPage() {
  return (
    <Suspense fallback={<LoadingState variant="skeleton" />}>
      <SettingsContainer />
    </Suspense>
  )
}
