'use client'

import { useEffect, useRef, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import type { SearchSuggestion } from '@resovo/types'

interface SearchSuggestionsProps {
  query: string
  onSelect: (text: string) => void
}

const DEBOUNCE_MS = 120

const ICON: Record<string, string> = {
  video:    '🎬',
  director: '🎥',
  actor:    '⭐',
  writer:   '✍️',
}

/**
 * 搜索联想词下拉列表，debounce 120ms 调 GET /search/suggest。
 * 空 query 时不显示。
 */
export function SearchSuggestions({ query, onSelect }: SearchSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([])
      return
    }

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await apiClient.get<{ data: SearchSuggestion[] }>(
          `/search/suggest?q=${encodeURIComponent(query.trim())}&limit=6`,
          { skipAuth: true }
        )
        setSuggestions(res.data)
      } catch {
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query])

  if (!query.trim()) return null
  if (loading) return (
    <div className="py-2 px-3 text-sm" style={{ color: 'var(--fg-subtle)' }}>
      搜索中…
    </div>
  )
  if (suggestions.length === 0) return null

  return (
    <ul
      role="listbox"
      aria-label="搜索建议"
      className="rounded-xl border shadow-lg overflow-hidden"
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}
    >
      {suggestions.map((s, i) => (
        <li key={i} role="option" aria-selected={false}>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors hover:bg-[var(--bg-surface-sunken)]"
            style={{ color: 'var(--fg-default)' }}
            onClick={() => onSelect(s.text)}
          >
            <span aria-hidden="true">{ICON[s.type] ?? '🔍'}</span>
            <span className="flex-1 truncate">{s.text}</span>
            {s.role && (
              <span className="shrink-0 text-xs" style={{ color: 'var(--fg-subtle)' }}>
                {s.role}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}
