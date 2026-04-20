import type { Metadata } from 'next'
import { VideoDetailClient } from '@/components/video/VideoDetailClient'
import { fetchVideoMeta } from '@/lib/video-detail'

interface PageProps {
  params: Promise<{ locale: string; slug: string }>
}

export async function detailGenerateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const video = await fetchVideoMeta(slug)
  if (!video) return { title: '流光视频' }
  const description = video.description?.slice(0, 150) ?? undefined
  return {
    title: `${video.title} - 流光`,
    description,
    openGraph: {
      title: `${video.title} - 流光`,
      description,
      images: video.coverUrl ? [{ url: video.coverUrl }] : [],
    },
  }
}

export function createDetailPage(showEpisodes: boolean) {
  return async function DetailPage({ params }: PageProps) {
    const { slug } = await params
    return <VideoDetailClient slug={slug} showEpisodes={showEpisodes} />
  }
}
