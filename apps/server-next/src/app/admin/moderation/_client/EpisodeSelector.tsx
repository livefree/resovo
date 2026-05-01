'use client'

import React, { useState } from 'react'

interface EpisodeSelectorProps {
  readonly total: number
  readonly current: number
  readonly onSelect: (ep: number) => void
}

const PER_PAGE = 20

const BTN: React.CSSProperties = {
  padding: '3px 8px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg2)',
  color: 'var(--fg-muted)',
  cursor: 'pointer',
  fontSize: 11,
}

export function EpisodeSelector({ total, current, onSelect }: EpisodeSelectorProps): React.ReactElement {
  const [page, setPage] = useState(0)
  const maxPage = Math.max(0, Math.ceil(total / PER_PAGE) - 1)
  const start = page * PER_PAGE + 1
  const end = Math.min((page + 1) * PER_PAGE, total)

  return (
    <div data-episode-selector>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>选集</span>
        <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{total} 集</span>
        {total > PER_PAGE && (
          <>
            <span style={{ flex: 1 }} />
            <button style={BTN} disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</button>
            <span style={{ fontSize: 10, color: 'var(--fg-muted)' }}>{start}-{end}</span>
            <button style={BTN} disabled={page === maxPage} onClick={() => setPage(p => p + 1)}>›</button>
          </>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {Array.from({ length: end - start + 1 }, (_, i) => {
          const ep = start + i
          const isCurrent = ep === current
          return (
            <div
              key={ep}
              onClick={() => onSelect(ep)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && onSelect(ep)}
              aria-label={`第 ${ep} 集`}
              aria-pressed={isCurrent}
              style={{
                width: 34,
                height: 30,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: isCurrent ? 700 : 500,
                cursor: 'pointer',
                background: isCurrent ? 'var(--accent)' : 'var(--bg3)',
                color: isCurrent ? 'var(--fg-on-accent)' : 'var(--fg-muted)',
                border: `1px solid ${isCurrent ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              {ep}
            </div>
          )
        })}
      </div>
    </div>
  )
}
