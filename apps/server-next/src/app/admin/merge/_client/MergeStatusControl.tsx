'use client'

/**
 * MergeStatusControl.tsx — 操作内状态设置控件（CHG-VIR-13-D2 / 设计 §4.4）
 *
 * 受控 select（选项由调用方按场景产出：候选 = legalStatusOptions(current) 矩阵镜像 /
 * 工作区 = GENERIC_STATUS_OPTIONS / split = SPLIT_STATUS_OPTIONS）+ 智能默认 hint。
 * value=null = 保持不变（请求体不带新字段 R-105-T1 前端侧）。
 */

import { useMemo, type CSSProperties } from 'react'
import type { VideoStatusSetting } from '@resovo/types'
import type { StatusOption } from '@/lib/merge/status-defaults'
// CHG-VIR-13-I18N：语义文案字典
import { MERGE_M } from '@/i18n/messages/zh-CN/merge'

const ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
}

const LABEL_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-muted)',
}

const SELECT_STYLE: CSSProperties = {
  padding: '4px 6px',
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  border: '1px solid var(--border-default)',
  borderRadius: '4px',
  fontSize: 'var(--font-size-sm)',
}

const HINT_STYLE: CSSProperties = {
  fontSize: '11px',
  color: 'var(--state-warning-fg)',
}

export interface MergeStatusControlProps {
  readonly label?: string
  readonly options: readonly StatusOption[]
  /** null = 保持不变（不传字段） */
  readonly value: VideoStatusSetting | null
  readonly onChange: (value: VideoStatusSetting | null) => void
  /** 智能默认提示文案（suggestMergeTargetStatus().hint） */
  readonly hint?: string | null
  readonly disabled?: boolean
  readonly 'data-testid'?: string
}

export function MergeStatusControl({
  label = MERGE_M.statusControl.defaultLabel,
  options,
  value,
  onChange,
  hint,
  disabled,
  'data-testid': testId = 'merge-status-control',
}: MergeStatusControlProps) {
  // value → option key 反查（VideoStatusSetting 结构相等；找不到回退 keep）
  const selectedKey = useMemo(() => {
    if (value === null) return options.find((o) => o.value === null)?.key ?? 'keep'
    const match = options.find(
      (o) =>
        o.value !== null &&
        o.value.reviewStatus === value.reviewStatus &&
        o.value.visibilityStatus === value.visibilityStatus,
    )
    return match?.key ?? 'keep'
  }, [options, value])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-testid={testId}>
      <div style={ROW_STYLE}>
        <span style={LABEL_STYLE}>{label}：</span>
        <select
          aria-label={label}
          value={selectedKey}
          disabled={disabled}
          onChange={(e) => {
            const opt = options.find((o) => o.key === e.target.value)
            onChange(opt?.value ?? null)
          }}
          style={SELECT_STYLE}
          data-testid={`${testId}-select`}
        >
          {options.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      </div>
      {hint && (
        <span style={HINT_STYLE} data-testid={`${testId}-hint`}>
          {hint}
        </span>
      )}
    </div>
  )
}
