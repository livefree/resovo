import { Suspense } from 'react'
import { WatchPageClient } from './WatchPageClient'
import { PlayerShell } from '@/components/player/PlayerShell'

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

/**
 * REG-M3-04: /watch 页面含 Nav + Footer（正常页面布局）。
 * WatchPageClient 负责同步 slug → playerStore + 替换视频的 ConfirmDialog。
 * PlayerShell 直接内嵌在页面主内容区，GlobalPlayerFullFrame 在 watch 路由上返回 null 避免双重渲染。
 */
export default async function WatchPage({ params }: Props) {
  const { slug } = await params

  return (
    <div data-testid="watch-page" className="flex-1 flex flex-col">
      <WatchPageClient slug={slug} />
      <Suspense>
        <PlayerShell slug={slug} />
      </Suspense>
    </div>
  )
}
