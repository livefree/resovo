/**
 * ResultCard.tsx — 搜索结果卡片（横版，支持高亮标题）
 */

import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { MetaChip } from './MetaChip'
import type { SearchResult } from '@/types'

interface ResultCardProps {
  result: SearchResult
  className?: string
}

const TYPE_LABELS: Record<string, string> = {
  movie:   '电影',
  series:  '剧集',
  anime:   '动漫',
  variety: '综艺',
}

export function ResultCard({ result, className }: ResultCardProps) {
  const href = result.slug
    ? `/watch/${result.shortId}/${result.slug}`
    : `/watch/${result.shortId}`

  const highlightTitle = result.highlight?.title

  return (
    <Link
      href={href}
      className={cn(
        'group flex gap-4 p-3 rounded-lg transition-colors',
        'hover:bg-[var(--secondary)]',
        className
      )}
      data-testid="result-card"
    >
      {/* 封面（16:9 横版） */}
      <div
        className="relative shrink-0 rounded overflow-hidden"
        style={{ width: 128, aspectRatio: '16/9' }}
      >
        {result.coverUrl ? (
          <Image
            src={result.coverUrl}
            alt={result.title}
            fill
            sizes="128px"
            className="object-cover"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'var(--secondary)' }}
          >
            <span className="text-2xl opacity-30">🎬</span>
          </div>
        )}

        {/* 类型标签 */}
        <span
          className="absolute top-1 left-1 text-xs px-1 py-0.5 rounded font-medium"
          style={{ background: 'var(--gold)', color: 'black' }}
        >
          {TYPE_LABELS[result.type] ?? result.type}
        </span>
      </div>

      {/* 信息区 */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* 标题（支持 ES 高亮） */}
        {highlightTitle ? (
          <h3
            className={cn(
              'text-sm font-medium line-clamp-2 transition-colors',
              'group-hover:text-[var(--gold)]',
              '[&_em]:not-italic [&_em]:text-[var(--gold)] [&_em]:font-semibold'
            )}
            style={{ color: 'var(--foreground)' }}
            dangerouslySetInnerHTML={{ __html: highlightTitle }}
          />
        ) : (
          <h3
            className="text-sm font-medium line-clamp-2 group-hover:text-[var(--gold)] transition-colors"
            style={{ color: 'var(--foreground)' }}
          >
            {result.title}
          </h3>
        )}

        {/* 英文标题 */}
        {result.titleEn && (
          <p className="text-xs line-clamp-1" style={{ color: 'var(--muted-foreground)' }}>
            {result.titleEn}
          </p>
        )}

        {/* 元数据行 */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {result.rating !== null && (
            <span className="text-xs font-medium" style={{ color: '#f5c518' }}>
              ★ {result.rating.toFixed(1)}
            </span>
          )}
          {result.year && (
            <MetaChip label={String(result.year)} type="year" />
          )}
          <span
            className="text-xs"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {result.status === 'ongoing' ? '连载中' : '已完结'}
            {result.episodeCount > 1 && ` · ${result.episodeCount}集`}
          </span>
        </div>
      </div>
    </Link>
  )
}
