'use client'

/**
 * VideoDetailHero.tsx — 视频详情页 Hero 区（封面 + 全量信息）
 * Client Component（MetaChip 需要 useRouter，描述展开需要 useState）
 *
 * 布局参考豆瓣/TMDB：
 * - 左侧：封面海报（2:3） + 立即播放按钮
 * - 右侧：标题 → meta 行 → genres → 评分/线路/字幕 → 人员 → 简介
 */

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { MetaChip } from '@/components/search/MetaChip'
import type { Video } from '@/types'

// ── 标签映射 ────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  movie:       '电影',
  series:      '剧集',
  anime:       '动漫',
  variety:     '综艺',
  documentary: '纪录片',
  short:       '短剧',
  sports:      '体育',
  music:       '音乐',
  news:        '新闻',
  kids:        '少儿',
  other:       '其他',
}

const STATUS_LABELS: Record<string, string> = {
  ongoing:   '连载中',
  completed: '已完结',
}

const GENRE_LABELS: Record<string, string> = {
  action:       '动作',
  comedy:       '喜剧',
  romance:      '爱情',
  thriller:     '惊悚',
  horror:       '恐怖',
  sci_fi:       '科幻',
  fantasy:      '奇幻',
  history:      '历史',
  crime:        '犯罪',
  mystery:      '悬疑',
  war:          '战争',
  family:       '家庭',
  biography:    '传记',
  martial_arts: '武侠',
  other:        '其他',
}

const LANG_LABELS: Record<string, string> = {
  'zh-CN': '中文',
  'zh-TW': '繁体',
  en:      '英文',
  ja:      '日文',
  ko:      '韩文',
  fr:      '法文',
  de:      '德文',
  es:      '西语',
  ru:      '俄文',
  pt:      '葡语',
  ar:      '阿拉伯语',
  th:      '泰文',
  vi:      '越南语',
}

// 描述超过此字符数时折叠
const DESC_COLLAPSE_THRESHOLD = 150

// ── MetaRow（人员行）───────────────────────────────────────────────

interface MetaRowProps {
  label: string
  names: string[]
  type: 'director' | 'actor' | 'writer'
}

function MetaRow({ label, names, type }: MetaRowProps) {
  if (names.length === 0) return null
  return (
    <div className="flex gap-2 items-start">
      <span
        className="text-xs shrink-0 pt-0.5 w-12"
        style={{ color: 'var(--muted-foreground)' }}
      >
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {names.map((name) => (
          <MetaChip key={name} label={name} type={type} />
        ))}
      </div>
    </div>
  )
}

// ── Props ────────────────────────────────────────────────────────────

interface VideoDetailHeroProps {
  video: Video
}

// ── Component ────────────────────────────────────────────────────────

export function VideoDetailHero({ video }: VideoDetailHeroProps) {
  const [descExpanded, setDescExpanded] = useState(false)

  const watchHref = video.slug
    ? `/watch/${video.slug}-${video.shortId}?ep=1`
    : `/watch/${video.shortId}?ep=1`

  const hasPersonnel =
    video.director.length > 0 || video.cast.length > 0 || video.writers.length > 0

  const descLong =
    !!video.description && video.description.length > DESC_COLLAPSE_THRESHOLD

  const displayDesc =
    descLong && !descExpanded
      ? video.description!.slice(0, DESC_COLLAPSE_THRESHOLD) + '…'
      : video.description

  const subtitleDisplay = video.subtitleLangs
    .map((lang) => LANG_LABELS[lang] ?? lang)
    .slice(0, 4)
    .join(' / ')

  return (
    <section
      className="relative"
      style={{ background: 'var(--background)' }}
      data-testid="video-detail-hero"
    >
      {/* 背景模糊封面 */}
      {video.coverUrl && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
          <Image
            src={video.coverUrl}
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-10 blur-xl scale-110"
          />
        </div>
      )}

      <div className="relative z-10 max-w-screen-xl mx-auto px-4 py-10 md:py-16 flex flex-col md:flex-row gap-8 md:gap-12 items-start">

        {/* ── 左列：封面 + 播放按钮 ─────────────────────────────── */}
        <div className="shrink-0 flex flex-col gap-4 w-[180px] md:w-[240px] mx-auto md:mx-0">

          {/* 封面 */}
          <div
            className="relative w-full rounded-2xl overflow-hidden shadow-2xl border"
            style={{
              aspectRatio: '2/3',
              borderColor: 'color-mix(in srgb, var(--foreground) 10%, transparent)',
            }}
          >
            {video.coverUrl ? (
              <Image
                src={video.coverUrl}
                alt={video.title}
                fill
                sizes="(max-width: 768px) 180px, 240px"
                className="object-cover"
                data-testid="detail-cover"
              />
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: 'var(--secondary)' }}
              >
                <span className="text-5xl opacity-30">🎬</span>
              </div>
            )}
          </div>

          {/* 立即播放 */}
          <Link
            href={watchHref}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-sm font-bold transition-all shadow-[0_0_16px_rgba(232,184,75,0.25)] hover:shadow-[0_0_28px_rgba(232,184,75,0.55)] hover:scale-105"
            style={{ background: 'var(--accent)', color: 'var(--accent-foreground)' }}
            data-testid="detail-watch-btn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            立即播放
          </Link>
        </div>

        {/* ── 右列：全量信息 ──────────────────────────────────────── */}
        <div className="flex-1 space-y-5 pt-1 min-w-0">

          {/* 标题 */}
          <div className="space-y-1">
            <h1
              className="text-3xl md:text-4xl font-extrabold leading-tight tracking-tight"
              style={{ color: 'var(--foreground)' }}
              data-testid="detail-title"
            >
              {video.title}
            </h1>
            {video.titleEn && (
              <p
                className="text-base font-medium tracking-wide"
                style={{ color: 'var(--muted-foreground)' }}
              >
                {video.titleEn}
              </p>
            )}
          </div>

          {/* Meta 行：年份 · 地区 · 类型 · 状态 · 集数 */}
          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {video.year && <span>{video.year}</span>}
            {video.country && (
              <>
                <span className="opacity-30">·</span>
                <span>{video.country}</span>
              </>
            )}
            <span className="opacity-30">·</span>
            <span
              className="px-2 py-0.5 rounded text-xs font-bold"
              style={{ background: 'var(--accent)', color: 'var(--accent-foreground)' }}
            >
              {TYPE_LABELS[video.type] ?? video.type}
            </span>
            <span className="opacity-30">·</span>
            <span>{STATUS_LABELS[video.status] ?? video.status}</span>
            {video.episodeCount > 1 && (
              <>
                <span className="opacity-30">·</span>
                <span>全 {video.episodeCount} 集</span>
              </>
            )}
          </div>

          {/* 题材标签行 */}
          {video.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {video.genres.map((genre) => (
                <MetaChip
                  key={genre}
                  label={GENRE_LABELS[genre] ?? genre}
                  type="genre"
                />
              ))}
            </div>
          )}

          {/* 评分 · 线路 · 字幕 */}
          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm pt-1"
          >
            {video.rating !== null && (
              <div className="flex items-center gap-1.5">
                <span style={{ color: 'var(--accent)' }}>★</span>
                <span
                  className="text-lg font-extrabold"
                  style={{ color: 'var(--foreground)' }}
                >
                  {video.rating.toFixed(1)}
                </span>
              </div>
            )}

            {video.sourceCount > 0 && (
              <div
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border"
                style={{
                  color: 'var(--status-success)',
                  borderColor: 'var(--status-success)',
                  background: 'var(--status-success-bg)',
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                {video.sourceCount} 条线路
              </div>
            )}

            {video.subtitleLangs.length > 0 && (
              <div
                className="flex items-center gap-1 text-xs"
                style={{ color: 'var(--muted-foreground)' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                字幕：{subtitleDisplay}
              </div>
            )}
          </div>

          {/* 人员信息 */}
          {hasPersonnel && (
            <div
              className="space-y-2 pt-3 border-t"
              style={{ borderColor: 'var(--border)' }}
              data-testid="video-detail-meta"
            >
              <MetaRow label="导演" names={video.director} type="director" />
              <MetaRow label="编剧" names={video.writers} type="writer" />
              <MetaRow label="演员" names={video.cast} type="actor" />
            </div>
          )}

          {/* 剧情简介 */}
          {video.description && (
            <div
              className="space-y-1 pt-3 border-t"
              style={{ borderColor: 'var(--border)' }}
            >
              <h3
                className="text-sm font-semibold"
                style={{ color: 'var(--foreground)' }}
              >
                剧情简介
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--muted-foreground)' }}
                data-testid="detail-description"
              >
                {displayDesc}
                {descLong && (
                  <button
                    onClick={() => setDescExpanded((v) => !v)}
                    className="ml-1 text-xs font-medium underline underline-offset-2 hover:no-underline"
                    style={{ color: 'var(--accent)' }}
                  >
                    {descExpanded ? '收起' : '展开'}
                  </button>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
