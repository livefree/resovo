import { WatchPageClient } from './WatchPageClient'

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

/**
 * REG-M3-04: /watch 页面作为薄占位层。
 * 真正的播放器由 GlobalPlayerHost（Portal）渲染在 #global-player-host-portal 内。
 * WatchPageClient 负责同步 slug → playerStore + 替换视频的 ConfirmDialog。
 */
export default async function WatchPage({ params }: Props) {
  const { slug } = await params

  return (
    <div data-testid="watch-page" className="flex-1 flex flex-col">
      <WatchPageClient slug={slug} />
    </div>
  )
}
