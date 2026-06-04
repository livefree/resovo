'use client'

/**
 * MergeSplitSection.tsx — 拆分工作台子组件（从 MergeClient 提取，CHG-SN-7-MISC-MERGE-2）
 */

import { useState, useCallback, useEffect, useRef, type CSSProperties } from 'react'
import {
  AdminInput,
  AdminButton,
  LoadingState,
  ErrorState,
  EmptyState,
  useToast,
} from '@resovo/admin-ui'
import type { LineMatrixRow, SplitGroup, SplitSignal, SplitSuggestionsResult, VideoType } from '@resovo/types'
import { splitVideo, unmergeVideos, getSplitSuggestions } from '@/lib/merge/api'
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

// CHG-VIR-11-B（ADR-105 AMENDMENT 2026-06-03 D-105-1/6）：拆分建议消费 ──────────

/** 每组元数据：targetVideoId 非空 → 拆到已有 video（D-105-2 互斥；标题/类型不提交） */
interface GroupMeta {
  title: string
  type: VideoType
  targetVideoId: string
}

const DIMENSION_LABELS: Record<string, string> = {
  core_title_key: '核心标题',
  season: '季',
  release_marker: '发布形态',
  edition: '版本',
}

function describeSignal(signal: SplitSignal): string {
  switch (signal.kind) {
    case 'external_id_conflict':
      return `外部 ID 冲突（${signal.providers.join(' / ')}）`
    case 'intra_site_multi_title':
      return `站点 ${signal.siteKey || '(空)'} 内存在多标题，同站线路无法再分，建议人工核查`
    case 'episode_overlap':
      return '建议组间集数范围重叠（可能为不同作品同集数段）'
    case 'multi_core_title':
      return `多个核心标题：${signal.values.join(' / ')}`
    case 'multi_season':
      return `多个季号：${signal.values.join(' / ')}`
    case 'multi_release_marker':
      return `多个发布形态：${signal.values.join(' / ')}`
    case 'multi_edition':
      return `多个版本：${signal.values.join(' / ')}`
  }
}

interface SplitSectionProps {
  /** CHG-363-B：来自 MergeClient `?split=:videoId` 深链 / PendingCenter 拆分按钮 / 自动 setVideoIdInput + loadMatrix */
  readonly initialVideoId?: string
}

export function SplitSection({ initialVideoId }: SplitSectionProps = {}) {
  const [videoIdInput, setVideoIdInput] = useState(initialVideoId ?? '')
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null)
  const [lines, setLines] = useState<LineMatrixRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [groupCount, setGroupCount] = useState(2)
  const [assignments, setAssignments] = useState<Record<string, number>>({})
  const [groupMetas, setGroupMetas] = useState<GroupMeta[]>([
    { title: '分集 A', type: 'movie', targetVideoId: '' },
    { title: '分集 B', type: 'movie', targetVideoId: '' },
  ])
  // CHG-VIR-11-B：拆分建议（dimension/signals 展示 + 预填）
  const [suggestions, setSuggestions] = useState<SplitSuggestionsResult | null>(null)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const toast = useToast()

  // loadMatrix 接受 videoId 参数 / 避免 closure 依赖 videoIdInput state
  // （initialVideoId 自动加载场景：state 还没更新到 input 值就需要触发）
  const loadMatrix = useCallback((videoId: string) => {
    const id = videoId.trim()
    if (!id) return
    setLoading(true)
    setError(null)
    setActiveVideoId(id)
    setSuggestions(null)
    getVideoMatrix(id)
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
  }, [])

  // CHG-363-B：initialVideoId 深链自动加载 / autoLoadedRef 防 re-render 重复触发
  const autoLoadedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!initialVideoId) return
    if (autoLoadedRef.current === initialVideoId) return
    autoLoadedRef.current = initialVideoId
    setVideoIdInput(initialVideoId)
    loadMatrix(initialVideoId)
  }, [initialVideoId, loadMatrix])

  // CHG-VIR-11-B：生成拆分建议（D-105-1 只读预览）→ 预填 groupCount/groupMetas/assignments
  const handleSuggest = useCallback(async () => {
    if (!activeVideoId) return
    setSuggestLoading(true)
    try {
      const result = await getSplitSuggestions(activeVideoId)
      setSuggestions(result)
      if (!result.suggestible) {
        toast.push({
          level: 'info',
          title: '暂无可用拆分建议',
          description: '观测数据不足或各线路 facet 一致；可参考下方信号人工分组',
        })
        return
      }
      const n = Math.max(2, Math.min(20, result.groups.length))
      setGroupCount(n)
      setGroupMetas(result.groups.slice(0, n).map((g) => ({
        title: g.suggestedMeta.title,
        type: g.suggestedMeta.type,
        targetVideoId: '',
      })))
      // 建议组内 lines 的 sourceIds → 组 index；unassignedLines 留组 0（运营手动复核）
      const next: Record<string, number> = {}
      for (const line of result.unassignedLines) {
        for (const sid of line.sourceIds) next[sid] = 0
      }
      result.groups.slice(0, n).forEach((g, i) => {
        for (const line of g.lines) {
          for (const sid of line.sourceIds) next[sid] = i
        }
      })
      setAssignments((prev) => ({ ...prev, ...next }))
      toast.push({
        level: 'success',
        title: `已按「${DIMENSION_LABELS[result.dimension ?? ''] ?? result.dimension}」预填 ${result.groups.length} 组`,
        description: result.unassignedLines.length > 0
          ? `${result.unassignedLines.length} 条线路无观测数据未预填（留组 1，请人工复核）`
          : '请复核分组与标题后执行拆分',
      })
    } catch (err) {
      toast.push({ level: 'danger', title: '获取拆分建议失败', description: describeError(err, 'split') })
    } finally {
      setSuggestLoading(false)
    }
  }, [activeVideoId, toast])

  const handleSplit = useCallback(async () => {
    if (!activeVideoId || !lines) return
    const groups: SplitGroup[] = Array.from({ length: groupCount }, (_, i) => {
      const meta = groupMetas[i] ?? { title: `分集 ${String.fromCharCode(65 + i)}`, type: 'movie' as VideoType, targetVideoId: '' }
      const sourceIds = Object.entries(assignments).filter(([, g]) => g === i).map(([id]) => id)
      // D-105-2：targetVideoId 非空 → 拆到已有 video（与 newVideoMeta 互斥）
      const targetId = meta.targetVideoId.trim()
      return targetId !== ''
        ? { sourceIds, targetVideoId: targetId }
        : { sourceIds, newVideoMeta: { title: meta.title, type: meta.type } }
    }).filter((g) => g.sourceIds.length > 0)

    if (groups.length < 2) {
      toast.push({ level: 'warn', title: '拆分必须 ≥ 2 组', description: '每组至少 1 个 source' })
      return
    }

    const existingCount = groups.filter((g) => g.targetVideoId !== undefined).length
    try {
      const result = await splitVideo({ videoId: activeVideoId, groups })
      toast.push({
        level: 'success',
        title: '拆分成功',
        description: existingCount > 0
          ? `已创建 ${result.newVideoIds.length} 个新 video + 转入 ${existingCount} 个已有 video（auditId: ${result.auditId.slice(0, 8)}）`
          : `已创建 ${result.newVideoIds.length} 个新 video（auditId: ${result.auditId.slice(0, 8)}）`,
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
      setSuggestions(null)
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
        <AdminButton size="sm" variant="primary" onClick={() => loadMatrix(videoIdInput)} disabled={!videoIdInput.trim()}>
          加载 sources
        </AdminButton>
      </div>

      {loading ? (
        <LoadingState variant="skeleton" skeletonRows={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => loadMatrix(videoIdInput)} />
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
                  prev[i] ?? { title: `分集 ${String.fromCharCode(65 + i)}`, type: 'movie' as VideoType, targetVideoId: '' },
                ))
              }}
              style={{ width: '80px' }}
            />
            <span style={SECONDARY_TEXT}>每组 source 必须 ≥ 1 且全 source 必须有分配</span>
            {/* CHG-VIR-11-B：拆分自动分组建议（D-105-1 只读预览 + 预填） */}
            <AdminButton size="sm" variant="default" onClick={handleSuggest} disabled={suggestLoading} data-testid="split-suggest-btn">
              {suggestLoading ? '生成中…' : '生成拆分建议'}
            </AdminButton>
          </div>

          {suggestions && suggestions.signals.length > 0 && (
            <div
              data-testid="split-signals"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                padding: '8px 10px',
                borderRadius: '6px',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--fg-muted)',
              }}
            >
              {suggestions.dimension && (
                <span>建议维度：{DIMENSION_LABELS[suggestions.dimension] ?? suggestions.dimension}</span>
              )}
              {suggestions.signals.map((s, i) => (
                <span key={i}>· {describeSignal(s)}</span>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${groupCount}, 1fr)`, gap: '8px' }}>
            {Array.from({ length: groupCount }).map((_, i) => {
              const meta = groupMetas[i] ?? { title: '', type: 'movie' as VideoType, targetVideoId: '' }
              const toExisting = meta.targetVideoId.trim() !== ''
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <AdminInput
                    size="sm"
                    placeholder={`分集 ${String.fromCharCode(65 + i)} 标题`}
                    value={meta.title}
                    disabled={toExisting}
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
                    disabled={toExisting}
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
                  {/* CHG-VIR-11-B（D-105-2/5）：拆到已有 video——填 uuid 即转入该 video（仅转 sources，不改其元数据） */}
                  <AdminInput
                    size="sm"
                    placeholder="拆到已有 videoId（可选 uuid）"
                    value={meta.targetVideoId}
                    data-testid={`split-target-input-${i}`}
                    onChange={(e) => {
                      setGroupMetas((prev) => {
                        const next = [...prev]
                        next[i] = { ...meta, targetVideoId: e.target.value }
                        return next
                      })
                    }}
                  />
                  {toExisting && (
                    <span style={{ ...SECONDARY_TEXT, fontSize: '11px' }}>
                      转入已有 video：仅转移 sources，不修改其标题/类型
                    </span>
                  )}
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
