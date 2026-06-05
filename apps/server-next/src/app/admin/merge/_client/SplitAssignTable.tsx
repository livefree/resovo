'use client'

/**
 * SplitAssignTable.tsx — 拆分线路矩阵分配表（CHG-VIR-13-PLAY 自 SplitWorkspace 抽出，
 * 控制 500 行预算；设计 §11.4）
 *
 * 行 = (线路, 集)，分配到组 select + **▶ 播放抽验**（§10.5-2：拆分侧行级唤起，
 * 确认该线路内容归属哪个作品/组）。
 */

import { type CSSProperties } from 'react'
import type { LineMatrixRow } from '@resovo/types'
import type { PlayTarget } from './PlayPreviewDrawer'

const SELECT_STYLE: CSSProperties = {
  padding: '4px 6px',
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  border: '1px solid var(--border-default)',
  borderRadius: '4px',
  fontSize: 'var(--font-size-sm)',
}

const PLAY_BTN_STYLE: CSSProperties = {
  background: 'none',
  border: '1px solid var(--border-subtle)',
  borderRadius: 3,
  padding: '0 6px',
  cursor: 'pointer',
  color: 'var(--fg-default)',
  fontSize: '11px',
}

export interface SplitAssignTableProps {
  readonly lines: readonly LineMatrixRow[]
  readonly assignments: Record<string, number>
  readonly groupCount: number
  /** 组标题（select option 文案；缺位回退「分集 X」） */
  readonly groupLabels: readonly (string | undefined)[]
  readonly onAssign: (sourceId: string, group: number) => void
  /** 被拆视频（PlayTarget 构造用） */
  readonly videoId: string
  readonly videoTitle: string
  /** ▶ 播放抽验唤起（13-PLAY） */
  readonly onPlay: (target: PlayTarget) => void
}

export function SplitAssignTable({
  lines, assignments, groupCount, groupLabels, onAssign, videoId, videoTitle, onPlay,
}: SplitAssignTableProps) {
  return (
    <table style={{ width: '100%', fontSize: 'var(--font-size-sm)' }}>
      <thead>
        <tr style={{ textAlign: 'left', color: 'var(--fg-muted)' }}>
          <th style={{ padding: '4px 8px' }}>线路</th>
          <th style={{ padding: '4px 8px' }}>集</th>
          <th style={{ padding: '4px 8px' }}>URL</th>
          <th style={{ padding: '4px 8px', width: '120px' }}>分配到</th>
          <th style={{ padding: '4px 8px', width: '48px' }} aria-label="播放抽验" />
        </tr>
      </thead>
      <tbody>
        {lines.flatMap((line) =>
          line.episodes.map((ep) => (
            <tr key={ep.sourceId} style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <td style={{ padding: '6px 8px' }}>{line.displayName ?? line.sourceName}</td>
              <td style={{ padding: '6px 8px' }}>E{ep.episodeNumber}</td>
              <td style={{ padding: '6px 8px', color: 'var(--fg-muted)', fontSize: '11px', wordBreak: 'break-all' }}>
                {ep.sourceUrl.slice(0, 60)}{ep.sourceUrl.length > 60 ? '…' : ''}
              </td>
              <td style={{ padding: '6px 8px' }}>
                <select
                  value={assignments[ep.sourceId] ?? 0}
                  onChange={(e) => onAssign(ep.sourceId, parseInt(e.target.value, 10))}
                  style={SELECT_STYLE}
                >
                  {Array.from({ length: groupCount }).map((_, i) => (
                    <option key={i} value={i}>{groupLabels[i] ?? `分集 ${String.fromCharCode(65 + i)}`}</option>
                  ))}
                </select>
              </td>
              <td style={{ padding: '6px 8px' }}>
                {/* CHG-VIR-13-PLAY：行级播放抽验（确认线路内容归属哪个组/作品） */}
                <button
                  type="button"
                  style={PLAY_BTN_STYLE}
                  onClick={() => onPlay({
                    videoId,
                    videoTitle,
                    sourceId: ep.sourceId,
                    sourceUrl: ep.sourceUrl,
                    episodeNumber: ep.episodeNumber,
                    lineLabel: line.displayName ?? line.sourceName,
                  })}
                  data-testid={`split-play-${ep.sourceId}`}
                  aria-label={`播放抽验 ${line.displayName ?? line.sourceName} E${ep.episodeNumber}`}
                >
                  ▶
                </button>
              </td>
            </tr>
          )),
        )}
      </tbody>
    </table>
  )
}
