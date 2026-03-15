/**
 * CCPanel.tsx — 字幕语言切换面板
 */

'use client'

import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/stores/playerStore'

interface CCPanelProps {
  subtitleLangs: string[]
  activeLang: string | null
  onSelect: (lang: string | null) => void
  className?: string
}

const LANG_LABELS: Record<string, string> = {
  'zh-CN': '中文简体',
  'zh-TW': '中文繁体',
  'en':    'English',
  'ja':    '日本語',
  'ko':    '한국어',
}

export function CCPanel({ subtitleLangs, activeLang, onSelect, className }: CCPanelProps) {
  const { closePanel } = usePlayerStore()

  if (subtitleLangs.length === 0) {
    return (
      <div
        className={cn('px-4 py-3 rounded-lg text-sm', className)}
        style={{ background: 'rgba(0,0,0,0.85)', color: 'rgba(255,255,255,0.7)' }}
        data-testid="cc-panel"
      >
        暂无字幕
      </div>
    )
  }

  return (
    <div
      className={cn('rounded-lg overflow-hidden', className)}
      style={{ background: 'rgba(0,0,0,0.85)' }}
      data-testid="cc-panel"
    >
      <div className="px-4 py-2 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
        字幕
      </div>

      {/* 关闭字幕 */}
      <button
        onClick={() => { onSelect(null); closePanel('cc') }}
        className={cn(
          'w-full text-left px-4 py-2 text-sm transition-colors hover:bg-white/10',
          activeLang === null ? 'font-semibold' : ''
        )}
        style={activeLang === null ? { color: 'var(--gold)' } : { color: 'white' }}
        data-testid="cc-off"
      >
        关闭字幕
      </button>

      {/* 字幕语言列表 */}
      {subtitleLangs.map((lang) => (
        <button
          key={lang}
          onClick={() => { onSelect(lang); closePanel('cc') }}
          className={cn(
            'w-full text-left px-4 py-2 text-sm transition-colors hover:bg-white/10',
            activeLang === lang ? 'font-semibold' : ''
          )}
          style={activeLang === lang ? { color: 'var(--gold)' } : { color: 'white' }}
          data-testid={`cc-lang-${lang}`}
        >
          {LANG_LABELS[lang] ?? lang}
        </button>
      ))}
    </div>
  )
}
