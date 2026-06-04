'use client'

/**
 * MergeResultPreview.tsx — 合并/拆分结果预览（CHG-VIR-13-B2A / 设计 §4.2 + §10.5 + §11.2/11.4）
 *
 * 双形态：
 *   - kind='merge'：合并后 target 形态（源数总和 / 站点并集 / 状态）随 target 切换即时重算
 *     + 其余成员置灰「将软删除（可撤销）」+ 状态降级警示（§4.2 警示区）
 *     + **结构级线路 × 集数预览**（§10.5：按需展开拉既有 getVideoMatrix ×N 前端合成；
 *       三类结构信号：集数互补正信号 / 同站同名线路重复 409 预警 / 完全重叠建议播放抽验）
 *   - kind='split'：每组拆出后形态（标题/类型/源数 + 组内线路明细零请求前端推导）
 *     + **原视频软删明示**（§10.2 增强 #4：`VideoMergesService.ts:551` 事实，旧 UI 零告知）
 *
 * 播放抽验锚点（13-PLAY）：结构预览格 onEpisodeClick 可选注入，本卡仅渲染钩子不实现抽屉。
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AdminButton } from '@resovo/admin-ui'
import type { LineMatrixRow, VideoSummaryForMerge } from '@resovo/types'
import { getVideoMatrix } from '@/lib/sources/api'

// ── 样式（CSS 变量零硬编码颜色）────────────────────────────────────

const PANEL_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '10px 12px',
  borderRadius: 6,
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
}

const MUTED_SM: CSSProperties = { fontSize: '11px', color: 'var(--fg-muted)' }
const TITLE_SM: CSSProperties = { fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--fg-muted)' }

const WARN_NOTE_STYLE: CSSProperties = {
  padding: '4px 10px',
  borderRadius: 6,
  fontSize: '11px',
  background: 'var(--state-warning-bg)',
  color: 'var(--state-warning-fg)',
  border: '1px solid var(--state-warning-border)',
}

const DANGER_NOTE_STYLE: CSSProperties = {
  padding: '4px 10px',
  borderRadius: 6,
  fontSize: '11px',
  background: 'var(--state-danger-bg)',
  color: 'var(--state-danger-fg)',
  border: '1px solid var(--state-danger-border)',
}

const INFO_NOTE_STYLE: CSSProperties = {
  padding: '4px 10px',
  borderRadius: 6,
  fontSize: '11px',
  background: 'var(--bg-subtle)',
  color: 'var(--fg-muted)',
  border: '1px solid var(--border-subtle)',
}

const SOFT_DELETE_ROW: CSSProperties = {
  ...MUTED_SM,
  textDecoration: 'line-through',
  opacity: 0.75,
}

const ORIGIN_BADGE_STYLE: CSSProperties = {
  display: 'inline-block',
  padding: '0 6px',
  marginRight: 6,
  borderRadius: 4,
  fontSize: '10px',
  background: 'var(--bg-subtle)',
  color: 'var(--fg-muted)',
  border: '1px solid var(--border-subtle)',
}

// ── 结构级预览（§10.5）────────────────────────────────────────────

/** 合成行：来源 video 标注的线路 × 集数 */
export interface CombinedLine {
  readonly fromVideoId: string
  readonly fromTitle: string
  readonly lineKey: string       // `${siteKey}|${sourceName}`
  readonly displayName: string
  readonly episodes: readonly { readonly episodeNumber: number; readonly sourceId: string; readonly sourceUrl: string }[]
}

export interface StructureSignal {
  readonly tone: 'ok' | 'danger' | 'info'
  readonly text: string
}

/**
 * 合并后线路矩阵合成 + 三类结构信号（纯函数，可单测）：
 *  - 同站同名线路跨 video 重复 → danger（执行将触发跨站源冲突 409 预检 / R-105-1）
 *  - 集数互补（并集无重叠）→ ok 正信号
 *  - 跨 video 集数完全重叠 → info 建议播放抽验（可能为版本/语言差异）
 */
export function combineMatrices(
  inputs: readonly { readonly video: VideoSummaryForMerge; readonly lines: readonly LineMatrixRow[] }[],
): { lines: readonly CombinedLine[]; signals: readonly StructureSignal[] } {
  const lines: CombinedLine[] = []
  for (const { video, lines: rows } of inputs) {
    for (const row of rows) {
      lines.push({
        fromVideoId: video.id,
        fromTitle: video.title,
        lineKey: `${row.sourceSiteKey}|${row.sourceName}`,
        displayName: row.displayName ?? row.sourceName,
        episodes: row.episodes.map((e) => ({ episodeNumber: e.episodeNumber, sourceId: e.sourceId, sourceUrl: e.sourceUrl })),
      })
    }
  }

  const signals: StructureSignal[] = []

  // ① 同站同名线路跨 video 重复 → 409 预警
  const byLineKey = new Map<string, Set<string>>()
  for (const l of lines) {
    const set = byLineKey.get(l.lineKey) ?? new Set<string>()
    set.add(l.fromVideoId)
    byLineKey.set(l.lineKey, set)
  }
  const dupLines = [...byLineKey.entries()].filter(([, vids]) => vids.size > 1)
  if (dupLines.length > 0) {
    signals.push({
      tone: 'danger',
      text: `同站同名线路跨视频重复（${dupLines.map(([k]) => k.split('|')[1]).join('、')}）— 执行合并将触发跨站源冲突（409），请先在 /admin/sources 处理`,
    })
  }

  // ②/③ 集数关系（按 video 聚合集数集合，两两比较）
  const epsByVideo = new Map<string, Set<number>>()
  for (const l of lines) {
    const set = epsByVideo.get(l.fromVideoId) ?? new Set<number>()
    for (const e of l.episodes) set.add(e.episodeNumber)
    epsByVideo.set(l.fromVideoId, set)
  }
  const videoIds = [...epsByVideo.keys()]
  let hasOverlapAll = false
  let hasComplement = false
  for (let i = 0; i < videoIds.length; i++) {
    for (let j = i + 1; j < videoIds.length; j++) {
      const a = epsByVideo.get(videoIds[i]!)!
      const b = epsByVideo.get(videoIds[j]!)!
      if (a.size === 0 || b.size === 0) continue
      const inter = [...a].filter((x) => b.has(x))
      if (inter.length === 0) hasComplement = true
      else if (inter.length === Math.min(a.size, b.size)) hasOverlapAll = true
    }
  }
  if (hasComplement) {
    signals.push({ tone: 'ok', text: '存在集数互补的视频对（无重叠）— 疑似同作品分段收录，合并后集数覆盖更完整' })
  }
  if (hasOverlapAll) {
    signals.push({ tone: 'info', text: '存在集数完全重叠的视频对 — 建议播放抽验确认是否同内容（可能为版本/语言差异）' })
  }

  return { lines, signals }
}

// ── merge 形态 ─────────────────────────────────────────────────────

export interface MergeResultPreviewMergeProps {
  readonly kind: 'merge'
  readonly videos: readonly VideoSummaryForMerge[]
  readonly targetId: string
  /** 13-PLAY 播放抽验锚点（可选注入；本卡仅渲染 ▶ 钩子） */
  readonly onEpisodeClick?: (args: { videoId: string; sourceId: string; sourceUrl: string; episodeNumber: number }) => void
}

// ── split 形态 ─────────────────────────────────────────────────────

export interface SplitPreviewGroup {
  readonly label: string
  /** 转入已有 video 时的目标描述（存在即「转入」形态，不改其元数据 / D-105-5） */
  readonly existingTarget?: string
  readonly typeLabel?: string
  readonly sourceCount: number
  /** 组内线路明细（分配表前端推导零请求 / §10.5） */
  readonly lineSummaries: readonly string[]
}

export interface MergeResultPreviewSplitProps {
  readonly kind: 'split'
  readonly originalTitle: string
  readonly groups: readonly SplitPreviewGroup[]
}

export type MergeResultPreviewProps = MergeResultPreviewMergeProps | MergeResultPreviewSplitProps

export function MergeResultPreview(props: MergeResultPreviewProps) {
  if (props.kind === 'split') return <SplitResultBody {...props} />
  return <MergeResultBody {...props} />
}

function MergeResultBody({ videos, targetId, onEpisodeClick }: MergeResultPreviewMergeProps) {
  const target = videos.find((v) => v.id === targetId)
  const sources = videos.filter((v) => v.id !== targetId)

  // After 汇总（随 target 切换即时重算）
  const after = useMemo(() => {
    const totalSources = videos.reduce((acc, v) => acc + v.sourceCount, 0)
    const siteUnion = new Set(videos.flatMap((v) => [...v.sourceSiteKeys]))
    return { totalSources, siteCount: siteUnion.size }
  }, [videos])

  // 状态降级警示：任一 source 已审公开而 target 非（§4.2 / 数据缺失时不警示）
  const downgrade = useMemo(() => {
    if (!target?.reviewStatus) return false
    const targetPublic = target.reviewStatus === 'approved' && target.visibilityStatus === 'public'
    return !targetPublic && sources.some(
      (s) => s.reviewStatus === 'approved' && s.visibilityStatus === 'public',
    )
  }, [target, sources])

  // 结构级预览（§10.5：按需展开 → getVideoMatrix ×N 并行；行展开保持轻量）
  const [structure, setStructure] = useState<ReturnType<typeof combineMatrices> | null>(null)
  const [structureLoading, setStructureLoading] = useState(false)
  const [structureError, setStructureError] = useState<string | null>(null)

  // Codex stop-time review FIX：stale 守卫 — videos 集合变化（候选组切换 / 成员增删）时
  // 旧结构预览立即失效 + 飞行中旧请求作废（seq 比对丢弃），防止把旧集合的线路显示在新集合下
  const videosKey = useMemo(() => videos.map((v) => v.id).join('|'), [videos])
  const requestSeqRef = useRef(0)
  useEffect(() => {
    requestSeqRef.current += 1
    setStructure(null)
    setStructureError(null)
    setStructureLoading(false)
  }, [videosKey])

  const loadStructure = useCallback(async () => {
    const seq = ++requestSeqRef.current
    setStructureLoading(true)
    setStructureError(null)
    try {
      const inputs = await Promise.all(
        videos.map(async (video) => ({ video, lines: await getVideoMatrix(video.id) })),
      )
      if (seq !== requestSeqRef.current) return // 过期响应（videos 已变 / 后发请求在先）丢弃
      setStructure(combineMatrices(inputs))
    } catch (err: unknown) {
      if (seq !== requestSeqRef.current) return
      setStructureError(err instanceof Error ? err.message : '线路预览加载失败')
    } finally {
      if (seq === requestSeqRef.current) setStructureLoading(false)
    }
  }, [videos])

  // unmount 后 setState 防护（最后一道：seq 永不匹配）
  useEffect(() => () => { requestSeqRef.current = Number.MAX_SAFE_INTEGER }, [])

  return (
    <div style={PANEL_STYLE} data-testid="merge-result-preview">
      <span style={TITLE_SM}>
        合并后：{target ? `「${target.title}」` : '—'} → {after.totalSources} 源 · {after.siteCount} 站
        {target?.reviewStatus && target.visibilityStatus && (
          <span style={MUTED_SM}>（状态：{target.reviewStatus === 'approved' ? '已审' : target.reviewStatus === 'rejected' ? '已拒' : '待审'}·{target.visibilityStatus === 'public' ? '公开' : target.visibilityStatus === 'internal' ? '内部' : '隐藏'}）</span>
        )}
      </span>

      {sources.length > 0 && (
        <ul style={{ margin: 0, padding: '0 0 0 16px' }} data-testid="merge-result-soft-delete-list">
          {sources.map((v) => (
            <li key={v.id} style={SOFT_DELETE_ROW}>
              {v.title}（{v.sourceCount} 源）— 将软删除（可撤销）
            </li>
          ))}
        </ul>
      )}

      {downgrade && (
        <div style={WARN_NOTE_STYLE} data-testid="merge-result-downgrade-warn">
          ⚠ 被合并视频中存在「已审·公开」内容，而 target 非公开 — 合并后这些内容将对外不可见（可在状态设置中调整 / 13-D2）
        </div>
      )}

      <div>
        <AdminButton
          size="sm"
          variant="default"
          onClick={() => void loadStructure()}
          disabled={structureLoading}
          data-testid="merge-result-structure-toggle"
        >
          {structureLoading ? '加载中…' : structure ? '刷新线路集数预览' : '▾ 展开线路集数预览'}
        </AdminButton>
      </div>

      {structureError && <div style={DANGER_NOTE_STYLE}>{structureError}</div>}

      {structure && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-testid="merge-result-structure">
          {structure.signals.map((s, i) => (
            <div
              key={i}
              style={s.tone === 'danger' ? DANGER_NOTE_STYLE : s.tone === 'ok' ? INFO_NOTE_STYLE : INFO_NOTE_STYLE}
              data-testid={`structure-signal-${s.tone}`}
            >
              {s.tone === 'danger' ? '⚠ ' : s.tone === 'ok' ? '✓ ' : 'ⓘ '}{s.text}
            </div>
          ))}
          {structure.lines.map((l, i) => (
            <div key={`${l.fromVideoId}-${l.lineKey}-${i}`} style={{ ...MUTED_SM, display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
              <span style={ORIGIN_BADGE_STYLE}>来自 {l.fromTitle}</span>
              <span style={{ fontWeight: 600 }}>{l.displayName}</span>
              <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
                {l.episodes.map((e) => (
                  onEpisodeClick ? (
                    <button
                      key={e.sourceId}
                      type="button"
                      onClick={() => onEpisodeClick({ videoId: l.fromVideoId, sourceId: e.sourceId, sourceUrl: e.sourceUrl, episodeNumber: e.episodeNumber })}
                      style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 3, padding: '0 4px', cursor: 'pointer', color: 'var(--fg-default)', fontSize: '11px' }}
                      data-testid={`structure-ep-${e.sourceId}`}
                    >▶E{e.episodeNumber}</button>
                  ) : (
                    <span key={e.sourceId} style={{ fontSize: '11px' }}>E{e.episodeNumber}</span>
                  )
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SplitResultBody({ originalTitle, groups }: MergeResultPreviewSplitProps) {
  return (
    <div style={PANEL_STYLE} data-testid="split-result-preview">
      <span style={TITLE_SM}>拆分后：{groups.length} 组</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
        {groups.map((g, i) => (
          <div
            key={i}
            style={{ border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}
            data-testid={`split-group-card-${i}`}
          >
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
              {g.existingTarget ? `+${g.sourceCount} 源 → 已有视频「${g.existingTarget}」` : g.label}
            </span>
            <span style={MUTED_SM}>
              {g.existingTarget
                ? '转入已有：仅转移播放源，不改其元数据与状态'
                : `${g.typeLabel ?? ''}${g.typeLabel ? ' · ' : ''}${g.sourceCount} 源（新建，默认待审·内部）`}
            </span>
            {g.lineSummaries.length > 0 && (
              <span style={{ ...MUTED_SM, fontSize: '10px' }}>└ {g.lineSummaries.join(' / ')}</span>
            )}
          </div>
        ))}
      </div>
      {/* §10.2 增强 #4：原视频去向明示（VideoMergesService split 软删原视频 — 旧 UI 零告知） */}
      <div style={WARN_NOTE_STYLE} data-testid="split-original-soft-delete-note">
        ⚠ 原视频「{originalTitle}」拆分后将软删除（可在操作记录撤销）
      </div>
    </div>
  )
}
