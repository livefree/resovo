'use client'

/**
 * MergeResultPreview.tsx — 合并/拆分结果预览（CHG-VIR-13-B2A / 设计 §4.2 + §10.5 + §11.2/11.4）
 *
 * 双形态：
 *   - kind='merge'：合并后 target 形态（源数总和 / 站点并集 / 状态）随 target 切换即时重算
 *     + 其余成员置灰「将软删除（可撤销）」+ 状态降级警示（§4.2 警示区）
 *     + 结构级线路 × 集数预览 + 播放抽验（CHG-VIR-13-PLAY 抽出 ./StructurePreview 共享，
 *       mode=merge 工作区直接消费同组件）
 *   - kind='split'：每组拆出后形态（标题/类型/源数 + 组内线路明细零请求前端推导）
 *     + **原视频软删明示**（§10.2 增强 #4：`VideoMergesService.ts:551` 事实，旧 UI 零告知）
 */

import { useMemo, type CSSProperties } from 'react'
import type { VideoSummaryForMerge } from '@resovo/types'
import { StructurePreview } from './StructurePreview'
import type { PlayTarget } from './PlayPreviewDrawer'

// 合成纯函数与类型真源迁至 StructurePreview（13-PLAY）；re-export 保持既有消费/测试 import 兼容
export { combineMatrices, type CombinedLine, type StructureSignal } from './StructurePreview'

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

const SOFT_DELETE_ROW: CSSProperties = {
  ...MUTED_SM,
  textDecoration: 'line-through',
  opacity: 0.75,
}

// ── merge 形态 ─────────────────────────────────────────────────────

export interface MergeResultPreviewMergeProps {
  readonly kind: 'merge'
  readonly videos: readonly VideoSummaryForMerge[]
  readonly targetId: string
  /** 播放抽验外部接管（可选；未注入时 ▶ 格唤起内置 PlayPreviewDrawer / 13-PLAY） */
  readonly onEpisodeClick?: (target: PlayTarget) => void
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

      {/* §10.5 结构级线路 × 集数预览 + 播放抽验（13-PLAY 共享组件） */}
      <StructurePreview videos={videos} onEpisodeClick={onEpisodeClick} />
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
