import { Suspense } from 'react'
import type { Metadata } from 'next'
import { LoadingState } from '@resovo/admin-ui'
import { ImageHealthClient } from './_client/ImageHealthClient'

export const metadata: Metadata = {
  title: '图片健康 | Resovo Admin',
}

export default function ImageHealthPage() {
  return (
    <Suspense fallback={<LoadingState variant="skeleton" />}>
      <ImageHealthClient />
    </Suspense>
  )
}
