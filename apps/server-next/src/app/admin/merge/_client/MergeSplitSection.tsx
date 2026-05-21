'use client'

/**
 * MergeSplitSection.tsx — 拆分工作台子组件（从 MergeClient 提取，CHG-SN-7-MISC-MERGE-2）
 */

import { useState, useCallback, type CSSProperties } from 'react'
import {
  AdminInput,
  AdminButton,
  LoadingState,
  ErrorState,
  EmptyState,
  useToast,
} from '@resovo/admin-ui'
import type { LineMatrixRow, VideoType } from '@resovo/types'
import { splitVideo, unmergeVideos } from '@/lib/merge/api'
import { getVideoMatrix } from '@/lib/sources/api'
import { describeError } from './MergeClient'

const SECONDARY_TEXT: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-muted)',
}

const VIDEO_TYPES: readonly { value: VideoType; label: string }[] = [
  { value: 'movie',       label: '电影' },
  { value: 'series',      label: '剧集' },
  { value: 'anime',       label: '动漫' },
  { value: 'variety',     label: '综艺' },
  { value: 'documentary', label: '纪录片' },
  { value: 'short',       label: '短片' },
  { value: 'sports',      label: '体育' },
  { value: 'music',       label: '音乐' },
  { value: 'news',        label: '资讯' },
  { value: 'kids',        label: '少儿' },
  { value: 'other',       label: '其他' },
]

const SELECT_STYLE: CSSProperties = {
  padding: '4px 6px',
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  border: '1px solid var(--border-default)',
  borderRadius: '4px',
  fontSize: 'var(--font-size-sm)',
}

export function SplitSection() {
  const [videoIdInput, setVideoIdInput] = useState('')
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null)
  const [lines, setLines] = useState<LineMatrixRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [groupCount, setGroupCount] = useState(2)
  const [assignments, setAssignments] = useState<Record<string, number>>({})
  const [groupMetas, setGroupMetas] = useState<{ title: string; type: VideoType }[]>([
    { title: '分集 A', type: 'movie' },
    { title: '分集 B', type: 'movie' },
  ])
  const toast = useToast()

  const loadMatrix = useCallback(() => {
    if (!videoIdInput.trim()) return
    setLoading(true)
    setError(null)
    setActiveVideoId(videoIdInput.trim())
    getVideoMatrix(videoIdInput.trim())
      .then((data) => {
        setLines(data)
        const init: Record<string, number> = {}
        for (const line of data) {
          for (const ep of line.episodes) init[ep.sourceId] = 0
        }
        setAssignments(init)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error('加载失败')))
      .finally(() => setLoading(false))
  }, [videoIdInput])

  const handleSplit = useCallback(async () => {
    if (!activeVideoId || !lines) return
    const groups = Array.from({ length: groupCount }, (_, i) => {
      const meta = groupMetas[i] ?? { title: `分集 ${String.fromCharCode(65 + i)}`, type: 'movie' as VideoType }
      return {
        sourceIds: Object.entries(assignments).filter(([, g]) => g === i).map(([id]) => id),
        newVideoMeta: { title: meta.title, type: meta.type },
      }
    }).filter((g) => g.sourceIds.length > 0)

    if (groups.length < 2) {
      toast.push({ level: 'warn', title: '拆分必须 ≥ 2 组', description: '每组至少 1 个 source' })
      return
    }

    try {
      const result = await splitVideo({ videoId: activeVideoId, groups })
      toast.push({
        level: 'success',
        title: '拆分成功',
        description: `已创建 ${result.newVideoIds.length} 个新 video（auditId: ${result.auditId.slice(0, 8)}）`,
        action: {
          label: '撤销',
          onClick: () => {
            unmergeVideos(result.auditId, '用户撤销拆分')
              .then(() => {
                toast.push({ level: 'success', title: '已撤销拆分' })
                setLines(null)
                setActiveVideoId(null)
              })
              .catch((err: unknown) => {
                toast.push({
                  level: 'danger',
                  title: '撤销失败',
                  description: err instanceof Error ? err.message : '未知错误',
                })
              })
          },
        },
      })
      setLines(null)
      setActiveVideoId(null)
    } catch (err) {
      toast.push({
        level: 'danger',
        title: '拆分失败',
        description: describeError(err, 'split'),
      })
    }
  }, [activeVideoId, lines, groupCount, assignments, groupMetas, toast])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <AdminInput
          size="sm"
          placeholder="输入要拆分的 videoId (uuid)"
          value={videoIdInput}
          onChange={(e) => setVideoIdInput(e.target.value)}
          style={{ width: '320px' }}
        />
        <AdminButton size="sm" variant="primary" onClick={loadMatrix} disabled={!videoIdInput.trim()}>
          加载 sources
        </AdminButton>
      </div>

      {loading ? (
        <LoadingState variant="skeleton" skeletonRows={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={loadMatrix} />
      ) : !lines ? (
        <EmptyState title="尚未加载" description="输入 videoId 后点击 '加载 sources'" />
      ) : lines.length === 0 ? (
        <EmptyState title="无 sources" description="该视频暂无播放线路" />
      ) : (
        <>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={SECONDARY_TEXT}>组数：</span>
            <AdminInput
              size="sm"
              type="number"
              min="2"
              max="20"
              value={String(groupCount)}
              onChange={(e) => {
                const n = Math.max(2, Math.min(20, parseInt(e.target.value, 10) || 2))
                setGroupCount(n)
                setGroupMetas((prev) => Array.from({ length: n }, (_, i) =>
                  prev[i] ?? { title: `分集 ${String.fromCharCode(65 + i)}`, type: 'movie' as VideoType },
                ))
              }}
              style={{ width: '80px' }}
            />
            <span style={SECONDARY_TEXT}>每组 source 必须 ≥ 1 且全 source 必须有分配</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${groupCount}, 1fr)`, gap: '8px' }}>
            {Array.from({ length: groupCount }).map((_, i) => {
              const meta = groupMetas[i] ?? { title: '', type: 'movie' as VideoType }
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <AdminInput
                    size="sm"
                    placeholder={`分集 ${String.fromCharCode(65 + i)} 标题`}
                    value={meta.title}
                    onChange={(e) => {
                      setGroupMetas((prev) => {
                        const next = [...prev]
                        next[i] = { ...meta, title: e.target.value }
                        return next
                      })
                    }}
                  />
                  <select
                    aria-label={`分集 ${String.fromCharCode(65 + i)} 类型`}
                    value={meta.type}
                    onChange={(e) => {
                      setGroupMetas((prev) => {
                        const next = [...prev]
                        next[i] = { ...meta, type: e.target.value as VideoType }
                        return next
                      })
                    }}
                    style={SELECT_STYLE}
                  >
                    {VIDEO_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>

          <table style={{ width: '100%', fontSize: 'var(--font-size-sm)' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--fg-muted)' }}>
                <th style={{ padding: '4px 8px' }}>线路</th>
                <th style={{ padding: '4px 8px' }}>集</th>
                <th style={{ padding: '4px 8px' }}>URL</th>
                <th style={{ padding: '4px 8px', width: '120px' }}>分配到</th>
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
                        onChange={(e) =>
                          setAssignments((prev) => ({ ...prev, [ep.sourceId]: parseInt(e.target.value, 10) }))
                        }
                        style={SELECT_STYLE}
                      >
                        {Array.from({ length: groupCount }).map((_, i) => (
                          <option key={i} value={i}>{groupMetas[i]?.title ?? `分集 ${String.fromCharCode(65 + i)}`}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <AdminButton size="sm" variant="primary" onClick={handleSplit}>
              执行拆分（{groupCount} 组）
            </AdminButton>
          </div>
        </>
      )}
    </div>
  )
}
