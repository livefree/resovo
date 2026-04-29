import { Suspense } from 'react'
import type { Metadata } from 'next'
import { LoadingState } from '@resovo/admin-ui'
import { VideoListClient } from './_client/VideoListClient'

export const metadata: Metadata = {
  title: '视频库 | Resovo Admin',
}

export default function VideosPage() {
  return (
    <Suspense fallback={<LoadingState variant="skeleton" />}>
      <VideoListClient />
    </Suspense>
  )
}
