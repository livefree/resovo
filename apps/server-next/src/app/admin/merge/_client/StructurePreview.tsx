'use client'

/**
 * StructurePreview.tsx — 结构级线路 × 集数预览 + 播放抽验（CHG-VIR-13-PLAY 自
 * MergeResultPreview 抽出；设计 §10.5 + §11.9）
 *
 * 输入仅需 `{ id, title }`（VideoSummaryForMerge 与 PickerVideoItem 通吃）——
 * 候选行展开（经 MergeResultPreview）与 mode=merge 工作区（MergeWorkspace 直接
 * 消费）共用，按需展开拉既有 getVideoMatrix ×N 前端合成。
 *
 * 三类结构信号：同站同名线路跨 video 重复（自动去重提示 / D-105-16）/ 集数互补（正信号）/
 * 完全重叠（建议播放抽验）。▶ 格默认唤起内置 PlayPreviewDrawer（同集对比切换）；
 * onEpisodeClick 外部注入时优先外部。
 *
 * stale 守卫（Codex review FIX ×2 沿袭）：videos 集合变化 → 旧结构/抽屉立即失效
 * + 飞行请求 seq 作废；unmount cleanup `+= 1`（禁 MAX 哨兵——StrictMode ref 保留
 * 下 `++` 超 2^53 精度会让守卫永久失效）。
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AdminButton } from '@resovo/admin-ui'
import type { LineMatrixRow } from '@resovo/types'
import { getVideoMatrix } from '@/lib/sources/api'
import { PlayPreviewDrawer, type PlayTarget } from './PlayPreviewDrawer'

// ── 样式（CSS 变量零硬编码颜色）────────────────────────────────────

const MUTED_SM: CSSProperties = { fontSize: '11px', color: 'var(--fg-muted)' }

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

// ── 合成纯函数（可单测）──────────────────────────────────────────

/** 最小视频输入（id + 展示标题） */
export interface StructureVideoRef {
  readonly id: string
  readonly title: string
}

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
 * 合并后线路矩阵合成 + 三类结构信号（纯函数）：
 *  - 同站同名线路跨 video 重复 → info（合并时自动去重取并集 / D-105-13）
 *  - 集数互补（并集无重叠）→ ok 正信号
 *  - 跨 video 集数完全重叠 → info 建议播放抽验（可能为版本/语言差异）
 */
export function combineMatrices(
  inputs: readonly { readonly video: StructureVideoRef; readonly lines: readonly LineMatrixRow[] }[],
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

  // ①a D-105-16（CHG-MERGE-DEDUP-EP）：(episodeNumber, sourceUrl) 精确重复计数 →
  // 「合并时将自动去重 N 条」——与后端 dedupeSourcesForMerge 的 PARTITION BY (ep,url)
  // 同口径预演（每组重复保留 1 条，N = Σ(组大小 − 1)）；数据源 = 已拉取矩阵零新端点
  const byEpUrl = new Map<string, number>()
  for (const l of lines) {
    for (const e of l.episodes) {
      const k = `${e.episodeNumber}|${e.sourceUrl}`
      byEpUrl.set(k, (byEpUrl.get(k) ?? 0) + 1)
    }
  }
  const dedupCount = [...byEpUrl.values()].reduce((acc, n) => acc + Math.max(0, n - 1), 0)
  if (dedupCount > 0) {
    signals.push({
      tone: 'info',
      text: `检测到 ${dedupCount} 条重复线路（同集数 + 同播放地址）— 合并时将自动去重 ${dedupCount} 条（线路取并集）`,
    })
  }

  // ①b 同站同名线路跨 video（URL 不同时不去重，合并后按线路键归并显示）
  const byLineKey = new Map<string, Set<string>>()
  for (const l of lines) {
    const set = byLineKey.get(l.lineKey) ?? new Set<string>()
    set.add(l.fromVideoId)
    byLineKey.set(l.lineKey, set)
  }
  const dupLines = [...byLineKey.entries()].filter(([, vids]) => vids.size > 1)
  if (dupLines.length > 0) {
    signals.push({
      tone: 'info',
      text: `同站同名线路跨视频（${dupLines.map(([k]) => k.split('|')[1]).join('、')}）— 合并后归并为同一线路显示`,
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

// ── 组件 ──────────────────────────────────────────────────────────

export interface StructurePreviewProps {
  readonly videos: readonly StructureVideoRef[]
  /** 播放抽验外部接管（可选；未注入时 ▶ 格唤起内置 PlayPreviewDrawer） */
  readonly onEpisodeClick?: (target: PlayTarget) => void
}

export function StructurePreview({ videos, onEpisodeClick }: StructurePreviewProps) {
  const [structure, setStructure] = useState<ReturnType<typeof combineMatrices> | null>(null)
  const [structureLoading, setStructureLoading] = useState(false)
  const [structureError, setStructureError] = useState<string | null>(null)

  // stale 守卫：videos 集合变化 → 旧结构/抽屉立即失效 + 飞行请求作废
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

  // CHG-VIR-13-PLAY：内置播放抽验（同集对比切换）
  const [playTarget, setPlayTarget] = useState<PlayTarget | null>(null)
  const playTargets = useMemo<readonly PlayTarget[]>(() => {
    if (!structure) return []
    return structure.lines.flatMap((l) =>
      l.episodes.map((e) => ({
        videoId: l.fromVideoId,
        videoTitle: l.fromTitle,
        sourceId: e.sourceId,
        sourceUrl: e.sourceUrl,
        episodeNumber: e.episodeNumber,
        lineLabel: l.displayName,
      })),
    )
  }, [structure])
  useEffect(() => { setPlayTarget(null) }, [videosKey])

  // unmount 时飞行请求作废（cleanup +1；禁 MAX 哨兵 — StrictMode ref 保留下守卫会永久失效）
  useEffect(() => () => { requestSeqRef.current += 1 }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
              style={s.tone === 'danger' ? DANGER_NOTE_STYLE : INFO_NOTE_STYLE}
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
                  <button
                    key={e.sourceId}
                    type="button"
                    onClick={() => {
                      const t: PlayTarget = {
                        videoId: l.fromVideoId,
                        videoTitle: l.fromTitle,
                        sourceId: e.sourceId,
                        sourceUrl: e.sourceUrl,
                        episodeNumber: e.episodeNumber,
                        lineLabel: l.displayName,
                      }
                      // 外部注入优先（消费方自管抽屉）；默认内置 PlayPreviewDrawer
                      if (onEpisodeClick) onEpisodeClick(t)
                      else setPlayTarget(t)
                    }}
                    style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 3, padding: '0 4px', cursor: 'pointer', color: 'var(--fg-default)', fontSize: '11px' }}
                    data-testid={`structure-ep-${e.sourceId}`}
                  >▶E{e.episodeNumber}</button>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 播放抽验抽屉（同集对比切换；外部 onEpisodeClick 注入时不渲染） */}
      {!onEpisodeClick && (
        <PlayPreviewDrawer
          open={playTarget !== null}
          current={playTarget}
          targets={playTargets}
          onSelect={setPlayTarget}
          onClose={() => setPlayTarget(null)}
        />
      )}
    </div>
  )
}
