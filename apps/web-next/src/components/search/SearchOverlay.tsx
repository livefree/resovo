'use client'

/**
 * SearchOverlay — HANDOFF-16 对齐 docs/frontend_design_spec_20260423.md §13.1
 *
 * 640px 宽浮层面板，在 Nav 搜索框下方展示快速跳转结果。
 * 快速跳转专用，不承载复杂筛选（规则见 spec §13.3）。
 * 本组件只负责结果展示；输入由父组件（Nav 搜索框）驱动。
 *
 * Token 消费（spec §13.1）：
 *   面板宽度         → var(--search-overlay-w)      640px
 *   面板圆角         → var(--search-overlay-radius)  16px
 *   分组 padding     → 12px 8px
 *   分组标题 padding → 8px 12px
 *   单条结果 padding → 10px 12px
 *   缩略图宽         → var(--search-thumb-w)         40px
 *   主信息 gap       → 12px
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { SafeImage } from '@/components/media'
import type { SearchSuggestion } from '@resovo/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchOverlayProps {
  /** 当前搜索关键词（由 Nav 输入框驱动） */
  query: string
  /** 用户点击"全部结果"或联想词时触发导航 */
  onNavigate: (q: string) => void
  /** 点击结果后关闭浮层 */
  onClose: () => void
  /** 当前 locale（用于构建结果链接） */
  locale?: string
  /** 无输入时展示的热门搜索词（来自 nav.hotSearchTerms，无 API 调用） */
  hotSearchTerms?: string[]
}

interface QuickResult {
  id: string
  title: string
  coverUrl: string | null
  type: string
  year: number | null
  slug: string | null
  shortId: string
}

// ── 结果类型标签 ──────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  movie:        '电影',
  series:       '剧集',
  anime:        '动漫',
  variety:      '综艺',
  documentary:  '纪录片',
}

// ── QuickResultItem ───────────────────────────────────────────────────────────

function QuickResultItem({
  result,
  onClick,
}: {
  result: QuickResult
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left transition-colors hover:bg-[var(--bg-surface-sunken)]"
      style={{
        padding: 'var(--search-item-pad)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--search-main-gap)',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      {/* 缩略图 40px × 60px (2:3) */}
      <div
        className="relative rounded overflow-hidden shrink-0"
        style={{ width: 'var(--search-thumb-w)', aspectRatio: '2/3' }}
      >
        <SafeImage
          src={result.coverUrl}
          alt={result.title}
          width={40}
          height={60}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', aspectRatio: 'unset' }}
          imgClassName="object-cover"
          fallback={{ seed: result.id }}
        />
      </div>

      {/* 主信息 */}
      <div className="flex-1 min-w-0 text-left">
        <p
          className="truncate"
          style={{ fontSize: '14px', fontWeight: 500, color: 'var(--fg-default)', lineHeight: '1.3' }}
        >
          {result.title}
        </p>
        <p style={{ fontSize: '12px', color: 'var(--fg-muted)', marginTop: 'var(--space-0-5)' }}>
          {[TYPE_LABELS[result.type] ?? result.type, result.year].filter(Boolean).join(' · ')}
        </p>
      </div>

      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ color: 'var(--fg-subtle)', flexShrink: 0 }}
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  )
}

// ── SuggestionItem ────────────────────────────────────────────────────────────

function SuggestionItem({
  suggestion,
  onClick,
}: {
  suggestion: SearchSuggestion
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left transition-colors hover:bg-[var(--bg-surface-sunken)]"
      style={{
        padding: 'var(--search-item-pad)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      <span aria-hidden="true" style={{ color: 'var(--fg-subtle)', fontSize: '14px' }}>🔍</span>
      <span className="flex-1 truncate" style={{ fontSize: '14px', color: 'var(--fg-default)' }}>
        {suggestion.text}
      </span>
      {suggestion.role && (
        <span style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>{suggestion.role}</span>
      )}
    </button>
  )
}

// ── SearchOverlay ─────────────────────────────────────────────────────────────

export function SearchOverlay({ query, onNavigate, onClose, locale = 'zh-CN', hotSearchTerms }: SearchOverlayProps) {
  const router = useRouter()
  const [quickResults, setQuickResults] = useState<QuickResult[]>([])
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 防抖 200ms 请求
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const q = query.trim()
    if (!q) { setQuickResults([]); setSuggestions([]); return }

    timerRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const [resultsRes, suggestRes] = await Promise.all([
          apiClient.get<{ data: QuickResult[] }>(
            `/search?q=${encodeURIComponent(q)}&limit=5`,
            { skipAuth: true }
          ),
          apiClient.get<{ data: SearchSuggestion[] }>(
            `/search/suggest?q=${encodeURIComponent(q)}&limit=4`,
            { skipAuth: true }
          ),
        ])
        setQuickResults(resultsRes.data)
        setSuggestions(suggestRes.data)
      } catch {
        setQuickResults([])
        setSuggestions([])
      } finally {
        setSearching(false)
      }
    }, 200)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query])

  function handleResultClick(result: QuickResult) {
    const slug = result.slug ? `${result.slug}-${result.shortId}` : result.shortId
    router.push(`/${locale}/watch/${slug}?ep=1`)
    onClose()
  }

  function handleSuggestionClick(suggestion: SearchSuggestion) {
    onNavigate(suggestion.text)
    onClose()
  }

  const hasQuery = !!query.trim()

  return (
    <div
      data-testid="search-overlay"
      className="absolute z-50 shadow-xl overflow-hidden"
      style={{
        top: 'calc(100% + 8px)',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'var(--search-overlay-w)',
        maxWidth: '95vw',
        borderRadius: 'var(--search-overlay-radius)',
        border: '1px solid var(--border-default)',
        background: 'var(--bg-surface)',
      }}
      role="listbox"
      aria-label="搜索快速结果"
    >
      {!hasQuery ? (
        hotSearchTerms && hotSearchTerms.length > 0 ? (
          <div style={{ padding: 'var(--search-group-pad)' }}>
            <p
              style={{
                padding: 'var(--search-group-title-pad)',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--fg-subtle)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                margin: 0,
              }}
            >
              热门搜索
            </p>
            {hotSearchTerms.map((term, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { onNavigate(term); onClose() }}
                className="w-full text-left transition-colors hover:bg-[var(--bg-surface-sunken)]"
                style={{
                  padding: 'var(--search-item-pad)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    minWidth: '18px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: i < 3 ? 'var(--accent-default)' : 'var(--fg-subtle)',
                    textAlign: 'center',
                  }}
                >
                  {i + 1}
                </span>
                <span className="flex-1 truncate" style={{ fontSize: '14px', color: 'var(--fg-default)' }}>
                  {term}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ padding: 'var(--search-empty-pad)', textAlign: 'center', color: 'var(--fg-muted)', fontSize: '13px' }}>
            输入关键词开始搜索
          </div>
        )
      ) : searching ? (
        <div style={{ padding: 'var(--space-4) var(--space-5)', color: 'var(--fg-muted)', fontSize: '13px' }}>
          搜索中…
        </div>
      ) : (
        <>
          {/* 快速结果分组 */}
          {quickResults.length > 0 && (
            <div style={{ padding: 'var(--search-group-pad)' }}>
              <p
                style={{
                  padding: 'var(--search-group-title-pad)',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--fg-subtle)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  margin: 0,
                }}
              >
                内容
              </p>
              {quickResults.map((r) => (
                <QuickResultItem key={r.id} result={r} onClick={() => handleResultClick(r)} />
              ))}
            </div>
          )}

          {/* 联想词分组 */}
          {suggestions.length > 0 && (
            <div
              style={{
                padding: 'var(--search-group-pad)',
                borderTop: quickResults.length > 0 ? '1px solid var(--border-subtle)' : undefined,
              }}
            >
              <p
                style={{
                  padding: 'var(--search-group-title-pad)',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--fg-subtle)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  margin: 0,
                }}
              >
                相关搜索
              </p>
              {suggestions.map((s, i) => (
                <SuggestionItem
                  key={i}
                  suggestion={s}
                  onClick={() => handleSuggestionClick(s)}
                />
              ))}
            </div>
          )}

          {/* 无结果 */}
          {quickResults.length === 0 && suggestions.length === 0 && (
            <div style={{ padding: 'var(--search-empty-pad)', textAlign: 'center', color: 'var(--fg-muted)', fontSize: '13px' }}>
              未找到相关内容
            </div>
          )}
        </>
      )}

      {/* 底部：查看全部结果 */}
      {hasQuery && !searching && (
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-default)' }}>
          <button
            type="button"
            onClick={() => { onNavigate(query); onClose() }}
            className="w-full transition-colors hover:bg-[var(--bg-surface-sunken)]"
            style={{
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius-base)',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--accent-default)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            查看 &ldquo;{query}&rdquo; 的全部结果 →
          </button>
        </div>
      )}
    </div>
  )
}
