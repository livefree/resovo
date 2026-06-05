'use client'

/**
 * CompareLinesRow.tsx — 对比矩阵「线路 · 播放」行（CHG-VIR-15-UX-B ③）
 *
 * CHG-VIR-17-PARTIAL 自 MergeComparePanel 拆出（500 行硬限）：每视频列自己的线路
 * + ▶En 集按钮 + 列内嵌 AdminPlayer（key=sourceId remount；多列可同时播对比画面）。
 * 列内播放状态（playByVideo）自管；单元格样式由父级 cellStyle 合成注入
 * （target 绿框 / 相同值行背景 / 排除列灰化口径单一真源在父级）。
 */

import { useState, type CSSProperties } from 'react'
import { AdminButton } from '@resovo/admin-ui'
import type { VideoSummaryForMerge, LineMatrixRow } from '@resovo/types'
import { AdminPlayer } from '../../moderation/_client/AdminPlayer'
import {
  FIELD_CELL_STYLE,
  MUTED,
  DANGER_TEXT,
  EP_BUTTON_STYLE,
  EP_BUTTON_ACTIVE_STYLE,
} from './MergeComparePanel.styles'

// ── 线路数据注入契约（CHG-VIR-15-UX-B ③；数据由消费方拉取） ─────────

export interface CompareLinesState {
  readonly status: 'idle' | 'loading' | 'error' | 'ready'
  /** videoId → 线路矩阵（ready 时有值） */
  readonly byVideo: ReadonlyMap<string, readonly LineMatrixRow[]>
  readonly error?: string
}

/** 列内播放目标（▶En 点击 → 该列内嵌播放器装载） */
interface InlinePlayTarget {
  readonly sourceId: string
  readonly sourceUrl: string
  readonly episodeNumber: number
  readonly lineLabel: string
}

export interface CompareLinesRowProps {
  readonly videos: readonly VideoSummaryForMerge[]
  readonly linesState: CompareLinesState
  /** 展开（idle/error → load）/ 收起（ready → 清数据） */
  readonly onToggleLines?: () => void
  /** 单元格样式合成（父级单一真源：target 绿框 + 相同值背景 + 排除灰化） */
  readonly cellStyle: (videoId: string, rowKey: string) => CSSProperties
}

export function CompareLinesRow({ videos, linesState, onToggleLines, cellStyle }: CompareLinesRowProps) {
  // UX-B ③：列内嵌播放器（per-video；多列可同时播放对比画面）
  const [playByVideo, setPlayByVideo] = useState<ReadonlyMap<string, InlinePlayTarget>>(new Map())

  return (
    <tr data-testid="compare-row-lines">
      <th style={FIELD_CELL_STYLE} scope="row">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
          <span>线路 · 播放</span>
          {onToggleLines && (
            <AdminButton
              size="sm"
              variant="default"
              disabled={linesState.status === 'loading'}
              onClick={onToggleLines}
              data-testid="compare-lines-toggle"
            >
              {linesState.status === 'loading' ? '加载中…'
                : linesState.status === 'ready' ? '▴ 收起'
                : '▾ 展开'}
            </AdminButton>
          )}
        </div>
      </th>
      {videos.map((v) => {
        const lines = linesState.byVideo.get(v.id) ?? []
        const playing = playByVideo.get(v.id) ?? null
        return (
          <td key={v.id} style={cellStyle(v.id, 'lines')} data-testid={`compare-lines-${v.id}`}>
            {linesState.status === 'error' ? (
              <span style={{ ...DANGER_TEXT, fontSize: '11px' }}>{linesState.error ?? '加载失败'}</span>
            ) : linesState.status !== 'ready' ? (
              <span style={MUTED}>—</span>
            ) : lines.length === 0 ? (
              <span style={MUTED}>无线路</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {lines.map((line) => (
                  <div key={`${line.sourceSiteKey}|${line.sourceName}`} style={{ fontSize: '11px' }}>
                    <span style={{ fontWeight: 600 }}>{line.displayName ?? line.sourceName}</span>
                    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', marginLeft: 6 }}>
                      {line.episodes.map((e) => {
                        const active = playing?.sourceId === e.sourceId
                        return (
                          <button
                            key={e.sourceId}
                            type="button"
                            style={active ? EP_BUTTON_ACTIVE_STYLE : EP_BUTTON_STYLE}
                            onClick={() => {
                              setPlayByVideo((prev) => {
                                const next = new Map(prev)
                                next.set(v.id, {
                                  sourceId: e.sourceId,
                                  sourceUrl: e.sourceUrl,
                                  episodeNumber: e.episodeNumber,
                                  lineLabel: line.displayName ?? line.sourceName,
                                })
                                return next
                              })
                            }}
                            data-testid={`compare-ep-${e.sourceId}`}
                          >▶E{e.episodeNumber}</button>
                        )
                      })}
                    </span>
                  </div>
                ))}
                {/* 列内嵌播放器（key=sourceId remount 重载；多列同播对比画面） */}
                {playing && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <AdminPlayer
                      key={playing.sourceId}
                      videoId={v.id}
                      sourceUrl={playing.sourceUrl}
                      sourceId={playing.sourceId}
                      title={v.title}
                      testId={`compare-player-${v.id}`}
                    />
                    <span style={{ ...MUTED, fontSize: '11px', display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <span>{playing.lineLabel} · E{playing.episodeNumber}</span>
                      <button
                        type="button"
                        style={EP_BUTTON_STYLE}
                        onClick={() => {
                          setPlayByVideo((prev) => {
                            const next = new Map(prev)
                            next.delete(v.id)
                            return next
                          })
                        }}
                        data-testid={`compare-player-close-${v.id}`}
                      >关闭</button>
                    </span>
                  </div>
                )}
              </div>
            )}
          </td>
        )
      })}
    </tr>
  )
}
