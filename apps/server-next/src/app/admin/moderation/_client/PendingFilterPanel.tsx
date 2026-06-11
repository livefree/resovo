'use client'

/**
 * PendingFilterPanel.tsx — 待审列表筛选弹层（MODUX-P3-2 / item 3 前端）
 *
 * 审核台**局部**组件：编辑 7 个筛选维度（类型 / 年代 / 富集 / 探测 / 豆瓣 / 备注 / 人工），
 * 消费 P3-1-B 落地的后端 year/decade/enrichmentStatus 过滤 + 既有 type/sourceCheckStatus/
 * doubanStatus/hasStaffNote/needsManualReview。
 *
 * 复用：admin-ui `Modal`（遮罩 / Esc / aria-modal，与 KeyboardHelpOverlay 同范式 →
 *   弹层打开时 LinesPanel 数字键经 [aria-modal] 守卫自动暂停）+ `AdminSelect` 通用选择器 +
 *   enum options（getVideoTypeOptions / getSourceCheckStatusOptions / getDoubanStatusOptions）+
 *   `ENRICHMENT_STATUSES` 枚举（packages/types 真源，P3-1-A 派生语义）。
 *
 * 职责边界：本组件只编辑本地 draft，「应用」时回调 onApply(next) 由 ModerationConsole 写 URL/state；
 *   不直接调 fetch、不持有 URL 同步逻辑。
 */

import React, { useEffect, useMemo, useState } from 'react'
import {
  Modal,
  AdminSelect,
  getVideoTypeOptions,
  getSourceCheckStatusOptions,
  getDoubanStatusOptions,
  type AdminSelectOption,
} from '@resovo/admin-ui'
import { ENRICHMENT_STATUSES } from '@resovo/types'
import type { FilterPresetQuery } from '@/lib/moderation/use-filter-presets'
import { M } from '@/i18n/messages/zh-CN/moderation'

const F = M.filterPanel

/** 「全部」哨兵值（AdminSelect value 为 string|null；空串 → 该维度 undefined）*/
const ALL = ''

const FIELD_ROW_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '88px 1fr',
  alignItems: 'center',
  gap: 10,
  padding: '5px 0',
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

const FOOT_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  marginTop: 16,
  paddingTop: 12,
  borderTop: '1px solid var(--border-subtle)',
}

const BTN_BASE: React.CSSProperties = {
  padding: '6px 14px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface-row)',
  color: 'var(--fg-default)',
  cursor: 'pointer',
  fontSize: 'var(--font-size-xs)',
}
const BTN_PRIMARY: React.CSSProperties = { ...BTN_BASE, background: 'var(--accent-default)', color: 'var(--fg-on-accent)', borderColor: 'var(--accent-default)' }

/** 当前十年到 1950s 的年代选项（降序）*/
function buildDecadeOptions(): readonly AdminSelectOption[] {
  const currentDecade = Math.floor(new Date().getFullYear() / 10) * 10
  const opts: AdminSelectOption[] = []
  for (let d = currentDecade; d >= 1950; d -= 10) {
    opts.push({ value: String(d), label: F.decadeSuffix(d) })
  }
  return opts
}

const ENRICHMENT_OPTIONS: readonly AdminSelectOption[] = ENRICHMENT_STATUSES.map((value) => ({
  value,
  label: F.enrichmentLabel[value] ?? value,
}))

export interface PendingFilterPanelProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly value: FilterPresetQuery
  readonly onApply: (next: FilterPresetQuery) => void
}

interface FieldRowProps {
  readonly label: string
  readonly children: React.ReactNode
}
function FieldRow({ label, children }: FieldRowProps): React.ReactElement {
  return (
    <div style={FIELD_ROW_STYLE}>
      <span style={LABEL_STYLE}>{label}</span>
      <div>{children}</div>
    </div>
  )
}

export function PendingFilterPanel({ open, onClose, value, onApply }: PendingFilterPanelProps): React.ReactElement {
  const [draft, setDraft] = useState<FilterPresetQuery>(value)

  // 每次打开同步外部最新值（URL/预设可能在弹层关闭期间变更）
  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])

  const decadeOptions = useMemo(buildDecadeOptions, [])
  const typeOptions = useMemo(() => getVideoTypeOptions(), [])
  const sourceCheckOptions = useMemo(() => getSourceCheckStatusOptions(), [])
  const doubanOptions = useMemo(() => getDoubanStatusOptions(), [])

  function setField<K extends keyof FilterPresetQuery>(key: K, val: FilterPresetQuery[K] | undefined): void {
    setDraft((d) => {
      const next = { ...d }
      if (val == null) delete next[key]
      else next[key] = val
      return next
    })
  }

  const withAll = (opts: readonly AdminSelectOption[]): readonly AdminSelectOption[] => [{ value: ALL, label: F.all }, ...opts]

  const hasStaffNoteValue = draft.hasStaffNote == null ? ALL : String(draft.hasStaffNote)
  const needsManualReviewValue = draft.needsManualReview === true ? 'true' : ALL

  const handleApply = (): void => {
    onApply(draft)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={F.title} size="sm" data-testid="moderation-filter-panel">
      <div data-filter-fields>
        <FieldRow label={F.type}>
          <AdminSelect
            options={withAll(typeOptions)}
            value={draft.type ?? ALL}
            onChange={(v) => setField('type', v || undefined)}
            placeholder={F.all}
            aria-label={F.type}
            data-testid="filter-type"
          />
        </FieldRow>
        <FieldRow label={F.decade}>
          <AdminSelect
            options={withAll(decadeOptions)}
            value={draft.decade != null ? String(draft.decade) : ALL}
            onChange={(v) => setField('decade', v ? Number(v) : undefined)}
            placeholder={F.all}
            aria-label={F.decade}
            data-testid="filter-decade"
          />
        </FieldRow>
        <FieldRow label={F.enrichment}>
          <AdminSelect
            options={withAll(ENRICHMENT_OPTIONS)}
            value={draft.enrichmentStatus ?? ALL}
            onChange={(v) => setField('enrichmentStatus', v || undefined)}
            placeholder={F.all}
            aria-label={F.enrichment}
            data-testid="filter-enrichment"
          />
        </FieldRow>
        <FieldRow label={F.sourceCheck}>
          <AdminSelect
            options={withAll(sourceCheckOptions)}
            value={draft.sourceCheckStatus ?? ALL}
            onChange={(v) => setField('sourceCheckStatus', v || undefined)}
            placeholder={F.all}
            aria-label={F.sourceCheck}
            data-testid="filter-source-check"
          />
        </FieldRow>
        <FieldRow label={F.douban}>
          <AdminSelect
            options={withAll(doubanOptions)}
            value={draft.doubanStatus ?? ALL}
            onChange={(v) => setField('doubanStatus', v || undefined)}
            placeholder={F.all}
            aria-label={F.douban}
            data-testid="filter-douban"
          />
        </FieldRow>
        <FieldRow label={F.staffNote}>
          <AdminSelect
            options={[
              { value: ALL, label: F.all },
              { value: 'true', label: F.hasStaffNoteYes },
              { value: 'false', label: F.hasStaffNoteNo },
            ]}
            value={hasStaffNoteValue}
            onChange={(v) => setField('hasStaffNote', v === ALL || v == null ? undefined : v === 'true')}
            aria-label={F.staffNote}
            data-testid="filter-staff-note"
          />
        </FieldRow>
        <FieldRow label={F.manualReview}>
          <AdminSelect
            options={[
              { value: ALL, label: F.all },
              { value: 'true', label: F.needsManualReviewYes },
            ]}
            value={needsManualReviewValue}
            onChange={(v) => setField('needsManualReview', v === 'true' ? true : undefined)}
            aria-label={F.manualReview}
            data-testid="filter-manual-review"
          />
        </FieldRow>
      </div>

      <div style={FOOT_STYLE}>
        <button type="button" style={BTN_BASE} onClick={() => setDraft({})} data-testid="filter-clear">
          {F.clear}
        </button>
        <button type="button" style={BTN_PRIMARY} onClick={handleApply} data-testid="filter-apply">
          {F.apply}
        </button>
      </div>
    </Modal>
  )
}
