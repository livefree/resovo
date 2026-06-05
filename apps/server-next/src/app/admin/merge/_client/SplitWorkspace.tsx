'use client'

/**
 * SplitWorkspace.tsx — 拆分工作区（CHG-VIR-13-B2B；原 MergeSplitSection.tsx 重命名，
 * 13-WS 预登记偏离兑现）
 *
 * 本卡改造（设计 §10.2 增强 #2 + §11.4）：
 *   - 拆分对象 = VideoPicker（替代手输 uuid + 加载按钮；选中即加载线路矩阵）
 *   - 「拆到已有 video」= 每组 VideoPicker（替代手填 uuid；选中即显示目标卡）
 *   - SplitResultPreview 嵌入（每组形态 + 组内线路明细零请求推导 + **原视频软删明示**）
 *
 * 历史：CHG-SN-7-MISC-MERGE-2 提取 / CHG-363-B 深链 / CHG-VIR-11-B 拆分建议 + 拆到已有。
 */

import { useState, useCallback, useEffect, useRef, useMemo, type CSSProperties } from 'react'
import {
  AdminInput,
  AdminButton,
  LoadingState,
  ErrorState,
  EmptyState,
  VideoPicker,
  useToast,
  type PickerVideoItem,
} from '@resovo/admin-ui'
import type { LineMatrixRow, SplitGroup, SplitSignal, SplitSuggestionsResult } from '@resovo/types'
import { splitVideo, unmergeVideos, getSplitSuggestions } from '@/lib/merge/api'
import { getVideoMatrix } from '@/lib/sources/api'
// CHG-VIR-13-FIX-PREFILL：深链标题充实走 by-id 精确查（listVideos q 不匹配 UUID）
import { videoPickerFetcher, fetchPickerItemByIdSafe } from '@/lib/videos/picker-fetcher'
import { describeError } from './MergeClient'
import { MergeResultPreview, type SplitPreviewGroup } from './MergeResultPreview'
// CHG-VIR-13-PLAY：分配表抽出（500 行预算）+ 行级 ▶ 播放抽验
import { SplitAssignTable } from './SplitAssignTable'
import { PlayPreviewDrawer, type PlayTarget } from './PlayPreviewDrawer'
// CHG-VIR-13-D2：组 meta 编辑卡抽出（500 行预算 + D-105-9 状态控件嵌入）
import { SplitGroupMetaCard, defaultMeta, VIDEO_TYPES, type GroupMeta } from './SplitGroupMetaCard'

const SECONDARY_TEXT: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-muted)',
}

// CHG-VIR-11-B（ADR-105 AMENDMENT 2026-06-03 D-105-1/6）：拆分建议消费 ──────────

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

export interface SplitWorkspaceProps {
  /** CHG-363-B：`?split=:videoId` 深链 / PendingCenter 拆分按钮 / 自动加载线路矩阵 */
  readonly initialVideoId?: string
}

export function SplitWorkspace({ initialVideoId }: SplitWorkspaceProps = {}) {
  // CHG-VIR-13-B2B：拆分对象 VideoPicker（选中即加载；标题供 SplitResultPreview 软删明示）
  const [selectedVideo, setSelectedVideo] = useState<PickerVideoItem | null>(null)
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null)
  const [lines, setLines] = useState<LineMatrixRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [groupCount, setGroupCount] = useState(2)
  const [assignments, setAssignments] = useState<Record<string, number>>({})
  const [groupMetas, setGroupMetas] = useState<GroupMeta[]>([defaultMeta(0), defaultMeta(1)])
  // CHG-VIR-11-B：拆分建议（dimension/signals 展示 + 预填）
  const [suggestions, setSuggestions] = useState<SplitSuggestionsResult | null>(null)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const toast = useToast()

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

  // 拆分对象选择 → 立即加载线路矩阵
  const handlePickVideo = useCallback((item: PickerVideoItem | null) => {
    setSelectedVideo(item)
    if (item) loadMatrix(item.id)
    else { setLines(null); setActiveVideoId(null); setSuggestions(null) }
  }, [loadMatrix])

  // CHG-363-B：initialVideoId 深链自动加载 / autoLoadedRef 防 re-render 重复触发
  // CHG-VIR-13-B2B：补 fetch 标题注入 picker（软删明示文案消费）
  const autoLoadedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!initialVideoId) return
    if (autoLoadedRef.current === initialVideoId) return
    autoLoadedRef.current = initialVideoId
    loadMatrix(initialVideoId)
    let cancelled = false
    // CHG-VIR-13-FIX-PREFILL：by-id 精确查（原 fetcher q=uuid 恒 0 结果，充实从未生效）
    fetchPickerItemByIdSafe(initialVideoId)
      .then((found) => {
        if (cancelled || !found) return
        setSelectedVideo(found)
      })
    return () => { cancelled = true }
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
        targetVideo: null,
        status: null,
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

  // CHG-VIR-13-PLAY：播放抽验抽屉（分配表行级 ▶ 唤起；targets = 全部 (线路, 集) 格）
  const [playTarget, setPlayTarget] = useState<PlayTarget | null>(null)
  const playTargets = useMemo<readonly PlayTarget[]>(() => {
    if (!lines || !activeVideoId) return []
    const title = selectedVideo?.title ?? activeVideoId.slice(0, 8)
    return lines.flatMap((line) =>
      line.episodes.map((ep) => ({
        videoId: activeVideoId,
        videoTitle: title,
        sourceId: ep.sourceId,
        sourceUrl: ep.sourceUrl,
        episodeNumber: ep.episodeNumber,
        lineLabel: line.displayName ?? line.sourceName,
      })),
    )
  }, [lines, activeVideoId, selectedVideo])
  // 拆分对象变化 → 抽屉关闭（stale 防护）
  useEffect(() => { setPlayTarget(null) }, [activeVideoId])

  // CHG-VIR-13-B2B（§10.5）：SplitResultPreview 组数据零请求前端推导
  // （每组 sourceCount + 按线路聚合集数范围明细）
  const previewGroups = useMemo<readonly SplitPreviewGroup[]>(() => {
    if (!lines) return []
    return Array.from({ length: groupCount }, (_, i) => {
      const meta = groupMetas[i] ?? defaultMeta(i)
      const groupSourceIds = new Set(
        Object.entries(assignments).filter(([, g]) => g === i).map(([id]) => id),
      )
      const lineSummaries: string[] = []
      let sourceCount = 0
      for (const line of lines) {
        const eps = line.episodes.filter((ep) => groupSourceIds.has(ep.sourceId))
        if (eps.length === 0) continue
        sourceCount += eps.length
        const nums = eps.map((e) => e.episodeNumber)
        const min = Math.min(...nums)
        const max = Math.max(...nums)
        lineSummaries.push(`${line.displayName ?? line.sourceName} ${min === max ? `E${min}` : `E${min}–E${max}`}`)
      }
      return {
        label: meta.title,
        existingTarget: meta.targetVideo?.title,
        typeLabel: VIDEO_TYPES.find((t) => t.value === meta.type)?.label,
        sourceCount,
        lineSummaries,
      }
    }).filter((g) => g.sourceCount > 0)
  }, [lines, groupCount, groupMetas, assignments])

  const handleSplit = useCallback(async () => {
    if (!activeVideoId || !lines) return
    const groups: SplitGroup[] = Array.from({ length: groupCount }, (_, i) => {
      const meta = groupMetas[i] ?? defaultMeta(i)
      const sourceIds = Object.entries(assignments).filter(([, g]) => g === i).map(([id]) => id)
      // D-105-2：targetVideo 非空 → 拆到已有 video（与 newVideoMeta 互斥）
      // CHG-VIR-13-D2 / D-105-9：新建路径携带状态设置（null = 默认待审不传字段 R-105-T1）
      return meta.targetVideo
        ? { sourceIds, targetVideoId: meta.targetVideo.id }
        : {
            sourceIds,
            newVideoMeta: {
              title: meta.title,
              type: meta.type,
              ...(meta.status ? { status: meta.status } : {}),
            },
          }
    }).filter((g) => g.sourceIds.length > 0)

    if (groups.length < 2) {
      toast.push({ level: 'warn', title: '拆分必须 ≥ 2 组', description: '每组至少 1 个 source' })
      return
    }

    const existingCount = groups.filter((g) => g.targetVideoId !== undefined).length
    try {
      const result = await splitVideo({ videoId: activeVideoId, groups })
      // D-105-10 / R-105-T3：post-COMMIT 状态写入失败可观测（数组形态逐 video）
      const failedCount = (result.statusTransition ?? []).filter((t) => t.result === 'failed').length
      if (failedCount > 0) {
        toast.push({
          level: 'warn',
          title: '部分状态未变更',
          description: `拆分成功，但 ${failedCount} 个新建视频的状态设置未生效（状态机拒绝），请在审核台手动调整`,
        })
      }
      toast.push({
        level: 'success',
        title: '拆分成功',
        description: (existingCount > 0
          ? `已创建 ${result.newVideoIds.length} 个新 video + 转入 ${existingCount} 个已有 video（auditId: ${result.auditId.slice(0, 8)}）`
          : `已创建 ${result.newVideoIds.length} 个新 video（auditId: ${result.auditId.slice(0, 8)}）`)
          + (result.dedupedCount ? `，自动去重 ${result.dedupedCount} 条重复线路` : ''),
        action: {
          label: '撤销',
          onClick: () => {
            unmergeVideos(result.auditId, '用户撤销拆分')
              .then(() => {
                toast.push({ level: 'success', title: '已撤销拆分' })
                setLines(null)
                setActiveVideoId(null)
                setSelectedVideo(null)
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
      setSelectedVideo(null)
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
      {/* CHG-VIR-13-B2B：拆分对象 VideoPicker（替代手输 uuid；选中即加载线路矩阵） */}
      <VideoPicker
        label="选择要拆分的视频"
        value={selectedVideo}
        onChange={handlePickVideo}
        fetcher={videoPickerFetcher}
        data-testid="split-video-picker"
      />

      {loading ? (
        <LoadingState variant="skeleton" skeletonRows={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => activeVideoId && loadMatrix(activeVideoId)} />
      ) : !lines ? (
        <EmptyState title="尚未加载" description="选择要拆分的视频后自动加载播放线路" />
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
                setGroupMetas((prev) => Array.from({ length: n }, (_, i) => prev[i] ?? defaultMeta(i)))
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

          {/* CHG-VIR-13-D2：组 meta 编辑卡（标题/类型/拆到已有/新建状态设置，抽 SplitGroupMetaCard） */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${groupCount}, 1fr)`, gap: '8px' }}>
            {Array.from({ length: groupCount }).map((_, i) => (
              <SplitGroupMetaCard
                key={i}
                index={i}
                meta={groupMetas[i] ?? defaultMeta(i)}
                onChange={(m) => {
                  setGroupMetas((prev) => {
                    const next = [...prev]
                    next[i] = m
                    return next
                  })
                }}
              />
            ))}
          </div>

          {/* CHG-VIR-13-PLAY：分配表子组件（行级 ▶ 播放抽验） */}
          <SplitAssignTable
            lines={lines}
            assignments={assignments}
            groupCount={groupCount}
            groupLabels={groupMetas.map((m) => m?.title)}
            onAssign={(sourceId, group) => setAssignments((prev) => ({ ...prev, [sourceId]: group }))}
            videoId={activeVideoId!}
            videoTitle={selectedVideo?.title ?? activeVideoId!.slice(0, 8)}
            onPlay={setPlayTarget}
          />

          {/* CHG-VIR-13-PLAY：播放抽验抽屉（同集 = 不同线路同集对比） */}
          <PlayPreviewDrawer
            open={playTarget !== null}
            current={playTarget}
            targets={playTargets}
            onSelect={setPlayTarget}
            onClose={() => setPlayTarget(null)}
          />

          {/* CHG-VIR-13-B2B（§10.2 #4 + §10.5）：拆分结果预览 — 每组形态 + 原视频软删明示 */}
          {previewGroups.length > 0 && (
            <MergeResultPreview
              kind="split"
              originalTitle={selectedVideo?.title ?? activeVideoId?.slice(0, 8) ?? '—'}
              groups={previewGroups}
            />
          )}

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
