'use client'

/**
 * SplitGroupMetaCard.tsx — 拆分组元数据编辑卡（CHG-VIR-13-D2 抽自 SplitWorkspace
 * 500 行预算 + 状态控件嵌入）
 *
 * 每组：标题 + 类型（新建路径）/ 拆到已有 VideoPicker（D-105-2 互斥，选中即只读）
 * + 新建状态设置（D-105-9 / §10.1 裁定 #1：默认待审 + 面板一键通过；
 * 拆到已有 video 状态只读 = 结构上无控件，D-105-5 不动元数据）。
 */

import { type CSSProperties } from 'react'
import { AdminInput, VideoPicker, type PickerVideoItem } from '@resovo/admin-ui'
import type { VideoStatusSetting, VideoType } from '@resovo/types'
import { SPLIT_STATUS_OPTIONS } from '@/lib/merge/status-defaults'
import { MERGE_M } from '@/i18n/messages/zh-CN/merge'
import { videoPickerFetcher } from '@/lib/videos/picker-fetcher'
import { MergeStatusControl } from './MergeStatusControl'

export const VIDEO_TYPES: readonly { value: VideoType; label: string }[] = [
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

const READONLY_NOTE_STYLE: CSSProperties = {
  fontSize: '11px',
  color: 'var(--fg-muted)',
}

/** 每组元数据：targetVideo 非空 → 拆到已有 video（D-105-2 互斥；标题/类型/状态不提交）
 *  CHG-VIR-13-D2：+status（新建路径操作内状态设置 / null = 默认待审不传字段） */
export interface GroupMeta {
  title: string
  type: VideoType
  targetVideo: PickerVideoItem | null
  status: VideoStatusSetting | null
}

export function defaultMeta(i: number): GroupMeta {
  return { title: `分集 ${String.fromCharCode(65 + i)}`, type: 'movie', targetVideo: null, status: null }
}

export interface SplitGroupMetaCardProps {
  readonly index: number
  readonly meta: GroupMeta
  readonly onChange: (meta: GroupMeta) => void
}

export function SplitGroupMetaCard({ index, meta, onChange }: SplitGroupMetaCardProps) {
  const toExisting = meta.targetVideo !== null
  const groupLabel = `分集 ${String.fromCharCode(65 + index)}`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <AdminInput
        size="sm"
        placeholder={`${groupLabel} 标题`}
        value={meta.title}
        disabled={toExisting}
        onChange={(e) => onChange({ ...meta, title: e.target.value })}
      />
      <select
        aria-label={`${groupLabel} 类型`}
        value={meta.type}
        disabled={toExisting}
        onChange={(e) => onChange({ ...meta, type: e.target.value as VideoType })}
        style={SELECT_STYLE}
      >
        {VIDEO_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      {/* CHG-VIR-13-B2B（D-105-2/5 + §10.2 #2）：拆到已有 video — VideoPicker 替代手填 uuid */}
      <VideoPicker
        label="拆到已有视频（可选）"
        value={meta.targetVideo}
        onChange={(item) => onChange({ ...meta, targetVideo: item })}
        fetcher={videoPickerFetcher}
        data-testid={`split-target-picker-${index}`}
      />
      {toExisting ? (
        <span style={READONLY_NOTE_STYLE}>
          转入已有 video：仅转移 sources，不修改其标题/类型/状态
        </span>
      ) : (
        // CHG-VIR-13-D2 / D-105-9（§10.1 裁定 #1）：新建 video 状态设置——
        // current 恒 pending|internal（insertNewVideo DB DEFAULT），选项全 ∈ 矩阵 pending 行
        <MergeStatusControl
          label={MERGE_M.statusControl.splitLabel}
          options={SPLIT_STATUS_OPTIONS}
          value={meta.status}
          onChange={(status) => onChange({ ...meta, status })}
          data-testid={`split-status-control-${index}`}
        />
      )}
    </div>
  )
}
