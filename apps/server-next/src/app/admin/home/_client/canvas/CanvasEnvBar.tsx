'use client'

/**
 * CanvasEnvBar.tsx — 画布环境栏（CHG-HOME-CANVAS-B / 方案 §3）
 *
 * brand / locale / preview time(at) / device 四参数，变更经 onApply 回传
 * HomeCanvas 重拉 preview（at 仅影响时间窗判定，ADR-182 D-182-4 #1）。
 */

import { useState, type ChangeEvent, type CSSProperties } from 'react'
import { AdminButton, AdminInput, AdminSelect, type AdminSelectOption } from '@resovo/admin-ui'
import type { HomePreviewQuery } from '@/lib/home-curation/types'

const DEVICE_OPTIONS: readonly AdminSelectOption[] = [
  { value: 'desktop', label: '桌面端' },
  { value: 'mobile', label: '移动端' },
]

const BAR_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: 10,
  padding: '10px 14px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-surface)',
  flexWrap: 'wrap',
}

const FIELD_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minWidth: 130,
}

const LABEL_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-2xs)',
  fontWeight: 500,
  color: 'var(--fg-muted)',
}

// datetime-local 原生 input（先例 HomeModuleDrawer / BannerDrawer）
const DATETIME_INPUT_STYLE: CSSProperties = {
  height: '28px',
  padding: '0 10px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--fg-default)',
  fontSize: 'var(--font-size-xs)',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

export interface CanvasEnvBarProps {
  readonly onApply: (query: HomePreviewQuery) => void
}

export function CanvasEnvBar({ onApply }: CanvasEnvBarProps) {
  const [brandSlug, setBrandSlug] = useState('')
  const [locale, setLocale] = useState('')
  const [at, setAt] = useState('')
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')

  function apply() {
    const atIso = at ? new Date(at).toISOString() : undefined
    onApply({
      brandSlug: brandSlug.trim() || undefined,
      locale: locale.trim() || undefined,
      at: atIso,
      device,
    })
  }

  return (
    <div style={BAR_STYLE} data-testid="canvas-env-bar">
      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>品牌 slug（空＝全品牌）</label>
        <AdminInput
          value={brandSlug}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setBrandSlug(e.target.value)}
          placeholder="如：alpha"
          size="sm"
          data-testid="env-brand-slug"
        />
      </div>
      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>locale</label>
        <AdminInput
          value={locale}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setLocale(e.target.value)}
          placeholder="如：zh-CN"
          size="sm"
          data-testid="env-locale"
        />
      </div>
      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>预览时间（空＝当前）</label>
        <input
          type="datetime-local"
          value={at}
          onChange={(e) => setAt(e.target.value)}
          style={DATETIME_INPUT_STYLE}
          data-testid="env-at"
        />
      </div>
      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>设备</label>
        <AdminSelect
          value={device}
          options={DEVICE_OPTIONS}
          onChange={(v) => setDevice((v ?? 'desktop') as 'desktop' | 'mobile')}
          size="sm"
          data-testid="env-device"
        />
      </div>
      <AdminButton variant="primary" size="sm" onClick={apply} data-testid="env-apply-btn">
        应用
      </AdminButton>
    </div>
  )
}
