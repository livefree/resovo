'use client'

/**
 * SavePresetModal — 保存筛选预设 Modal（CHG-SN-4-FIX-F · plan v1.6 §1 G7）
 *
 * 字段：名称（必填）/ 适用 Tab（select：当前 Tab / all）/ ☐ 设为默认
 * 走 admin-ui Modal 原语（继承 OverlayBackdrop 协议）。
 */
import React, { useState, useEffect } from 'react'
import { Modal } from '@resovo/admin-ui'
import { M } from '@/i18n/messages/zh-CN/moderation'
import type { FilterPresetQuery, FilterPresetTab } from '@/lib/moderation/use-filter-presets'

const FIELD_GROUP_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  marginBottom: 14,
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--fg-default)',
}

const INPUT_STYLE: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  fontSize: 13,
}

const ERROR_STYLE: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--state-error-fg)',
}

const FOOTER_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  marginTop: 8,
}

const BTN_GHOST_STYLE: React.CSSProperties = {
  padding: '6px 14px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface-elevated)',
  color: 'var(--fg-muted)',
  cursor: 'pointer',
  fontSize: 13,
}

const BTN_PRIMARY_STYLE: React.CSSProperties = {
  ...BTN_GHOST_STYLE,
  background: 'var(--accent-default)',
  color: 'var(--fg-on-accent)',
  borderColor: 'var(--accent-default)',
}

const CHECKBOX_LABEL_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
  color: 'var(--fg-default)',
  cursor: 'pointer',
}

export interface SavePresetModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly onSubmit: (input: { name: string; tab: FilterPresetTab; isDefault: boolean }) => void
  readonly currentTab: FilterPresetTab  // 默认填充
  readonly currentQuery: FilterPresetQuery  // 仅显示提示，不直接编辑
}

export function SavePresetModal({
  open,
  onClose,
  onSubmit,
  currentTab,
  currentQuery,
}: SavePresetModalProps): React.ReactElement {
  const [name, setName] = useState('')
  const [tab, setTab] = useState<FilterPresetTab>(currentTab)
  const [isDefault, setIsDefault] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  // 重置表单 when 打开
  useEffect(() => {
    if (open) {
      setName('')
      setTab(currentTab)
      setIsDefault(false)
      setNameError(null)
    }
  }, [open, currentTab])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError(M.preset.nameRequired)
      return
    }
    onSubmit({ name: trimmed, tab, isDefault })
  }

  return (
    <Modal open={open} onClose={onClose} title={M.preset.modalTitle} size="sm" data-testid="save-preset-modal">
      <form onSubmit={handleSubmit} noValidate data-save-preset-form>
        <div style={FIELD_GROUP_STYLE}>
          <label style={LABEL_STYLE} htmlFor="preset-name">{M.preset.nameLabel}</label>
          <input
            id="preset-name"
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setNameError(null) }}
            placeholder={M.preset.namePlaceholder}
            style={{
              ...INPUT_STYLE,
              borderColor: nameError ? 'var(--state-error-border)' : 'var(--border-default)',
            }}
            autoFocus
          />
          {nameError && <span style={ERROR_STYLE}>{nameError}</span>}
        </div>

        <div style={FIELD_GROUP_STYLE}>
          <label style={LABEL_STYLE} htmlFor="preset-tab">{M.preset.tabLabel}</label>
          <select
            id="preset-tab"
            value={tab}
            onChange={(e) => setTab(e.target.value as FilterPresetTab)}
            style={INPUT_STYLE}
          >
            <option value="all">{M.preset.tabAll}</option>
            <option value="pending">{M.preset.tabPending}</option>
            <option value="staging">{M.preset.tabStaging}</option>
            <option value="rejected">{M.preset.tabRejected}</option>
          </select>
        </div>

        <div style={FIELD_GROUP_STYLE}>
          <label style={CHECKBOX_LABEL_STYLE}>
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            {M.preset.isDefaultLabel}
          </label>
        </div>

        <div style={{ marginTop: 6, padding: '8px 10px', background: 'var(--bg-surface-raised)', borderRadius: 4, fontSize: 11, color: 'var(--fg-muted)' }}>
          当前筛选：{summarize(currentQuery)}
        </div>

        <div style={FOOTER_STYLE}>
          <button type="button" style={BTN_GHOST_STYLE} onClick={onClose}>{M.preset.cancelBtn}</button>
          <button type="submit" style={BTN_PRIMARY_STYLE}>{M.preset.saveBtn}</button>
        </div>
      </form>
    </Modal>
  )
}

function summarize(query: FilterPresetQuery): string {
  const parts: string[] = []
  if (query.type) parts.push(query.type)
  if (query.sourceCheckStatus) parts.push(`source:${query.sourceCheckStatus}`)
  if (query.doubanStatus) parts.push(`豆瓣:${query.doubanStatus}`)
  if (query.hasStaffNote === true) parts.push('有备注')
  if (query.needsManualReview === true) parts.push('需人工')
  return parts.length > 0 ? parts.join(' · ') : '无筛选'
}
