'use client'

/**
 * SwitchDomainModal — 批量切换 CDN fallback 域名 Modal（CHG-SN-7-MISC-IMAGE-1 / ADR-135）
 *
 * 先 dryRun=true 预览影响行数，确认后以 dryRun=false 执行实际替换。
 */
import React, { useState, useEffect, type FormEvent } from 'react'
import { Modal } from '@resovo/admin-ui'
import type { SwitchDomainResult } from '@/lib/image-health/api'

const FIELD_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  marginBottom: 14,
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontWeight: 600,
  color: 'var(--fg-default)',
}

const INPUT_STYLE: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  fontSize: 'var(--font-size-sm-tight)',
}

const ERROR_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-xxs)',
  color: 'var(--state-error-fg)',
}

const FOOTER_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  marginTop: 16,
}

const BTN_GHOST_STYLE: React.CSSProperties = {
  padding: '6px 14px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface-elevated)',
  color: 'var(--fg-muted)',
  cursor: 'pointer',
  fontSize: 'var(--font-size-sm-tight)',
}

const BTN_WARN_STYLE: React.CSSProperties = {
  ...BTN_GHOST_STYLE,
  background: 'var(--state-warning-bg)',
  color: 'var(--state-warning-fg)',
  borderColor: 'var(--state-warning-border)',
}

const BTN_PRIMARY_STYLE: React.CSSProperties = {
  ...BTN_GHOST_STYLE,
  background: 'var(--accent-default)',
  color: 'var(--fg-on-accent)',
  borderColor: 'var(--accent-default)',
}

const PREVIEW_STYLE: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--state-info-bg)',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-default)',
  marginBottom: 8,
}

export interface SwitchDomainModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly onPreview: (fromDomain: string, toDomain: string) => Promise<SwitchDomainResult>
  readonly onConfirm: (fromDomain: string, toDomain: string) => Promise<void>
  /** IMGH-P1-4：从 TOP 破损域名行「切此域」打开时预填源域名（省略 → 空白手填） */
  readonly initialFromDomain?: string
}

export function SwitchDomainModal({
  open,
  onClose,
  onPreview,
  onConfirm,
  initialFromDomain,
}: SwitchDomainModalProps): React.ReactElement {
  const [fromDomain, setFromDomain] = useState('')
  const [toDomain, setToDomain] = useState('')
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [preview, setPreview] = useState<SwitchDomainResult | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setFromDomain(initialFromDomain ?? '')
      setToDomain('')
      setErrors({})
      setPreview(null)
      setPreviewError(null)
    }
  }, [open, initialFromDomain])

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!fromDomain.trim()) errs.fromDomain = '必填'
    if (!toDomain.trim()) errs.toDomain = '必填'
    if (fromDomain.trim() && toDomain.trim() && fromDomain.trim() === toDomain.trim()) {
      errs.toDomain = '源域名与目标域名不能相同'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setPreviewing(true)
    setPreviewError(null)
    setPreview(null)
    try {
      const result = await onPreview(fromDomain.trim(), toDomain.trim())
      setPreview(result)
    } catch (err: unknown) {
      setPreviewError(err instanceof Error ? err.message : '预览失败，请稍后重试')
    } finally {
      setPreviewing(false)
    }
  }

  const handleConfirm = async () => {
    if (!preview || preview.affectedRows === 0) return
    setConfirming(true)
    try {
      await onConfirm(fromDomain.trim(), toDomain.trim())
    } finally {
      setConfirming(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="批量切换 fallback 域名" size="sm" data-testid="switch-domain-modal">
      <form onSubmit={(e: FormEvent) => void handlePreview(e)} noValidate>
        <div style={FIELD_STYLE}>
          <label style={LABEL_STYLE} htmlFor="switch-from-domain">源域名</label>
          <input
            id="switch-from-domain"
            type="text"
            value={fromDomain}
            onChange={(e) => { setFromDomain(e.target.value); setErrors((prev) => ({ ...prev, fromDomain: undefined })); setPreview(null) }}
            placeholder="old-cdn.example.com"
            style={{ ...INPUT_STYLE, borderColor: errors.fromDomain ? 'var(--state-error-border)' : 'var(--border-default)' }}
            autoFocus
          />
          {errors.fromDomain && <span style={ERROR_STYLE}>{errors.fromDomain}</span>}
        </div>

        <div style={FIELD_STYLE}>
          <label style={LABEL_STYLE} htmlFor="switch-to-domain">目标域名</label>
          <input
            id="switch-to-domain"
            type="text"
            value={toDomain}
            onChange={(e) => { setToDomain(e.target.value); setErrors((prev) => ({ ...prev, toDomain: undefined })); setPreview(null) }}
            placeholder="new-cdn.example.com"
            style={{ ...INPUT_STYLE, borderColor: errors.toDomain ? 'var(--state-error-border)' : 'var(--border-default)' }}
          />
          {errors.toDomain && <span style={ERROR_STYLE}>{errors.toDomain}</span>}
        </div>

        {previewError && (
          <div style={{ ...ERROR_STYLE, marginBottom: 8, padding: '4px 8px', background: 'var(--state-error-bg)', borderRadius: 4 }}>
            {previewError}
          </div>
        )}

        {preview && (
          <div style={PREVIEW_STYLE} data-testid="switch-domain-preview">
            <div style={{ fontWeight: 600, marginBottom: 6 }}>预览结果（dryRun）</div>
            <div>影响行数：<strong>{preview.affectedRows}</strong></div>
            <div style={{ marginTop: 4, fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)' }}>
              cover_url: {preview.breakdown.cover_url} · backdrop_url: {preview.breakdown.backdrop_url} · banner_backdrop_url: {preview.breakdown.banner_backdrop_url}
            </div>
            {preview.affectedRows === 0 && (
              <div style={{ marginTop: 6, color: 'var(--fg-muted)' }}>未找到匹配该域名的记录，无需切换</div>
            )}
          </div>
        )}

        <div style={FOOTER_STYLE}>
          <button type="button" style={BTN_GHOST_STYLE} onClick={onClose} disabled={previewing || confirming}>取消</button>
          {preview && preview.affectedRows > 0 ? (
            <button
              type="button"
              style={BTN_WARN_STYLE}
              onClick={() => void handleConfirm()}
              disabled={confirming}
              data-testid="switch-domain-confirm"
            >
              {confirming ? '执行中…' : `确认替换（${preview.affectedRows} 行）`}
            </button>
          ) : (
            <button type="submit" style={BTN_PRIMARY_STYLE} disabled={previewing} data-testid="switch-domain-preview-btn">
              {previewing ? '预览中…' : '预览影响'}
            </button>
          )}
        </div>
      </form>
    </Modal>
  )
}
