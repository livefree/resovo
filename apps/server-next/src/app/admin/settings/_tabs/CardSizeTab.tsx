'use client'

/**
 * CardSizeTab — 「前台展示」站点设置 Tab：前台卡片尺寸体系编辑面板（SEQ-20260622-03 Phase 3 / ADR-214/215）
 *
 * 消费端点（ADR-215 D-215-1/2，经 @/lib/card-size/api）：
 *   - GET  /admin/card-sizes           → 3 档全量
 *   - PUT  /admin/card-sizes/:sizeClass → 全替换该档可编辑投影
 *
 * 3 档封闭枚举（D-214-2）：
 *   - standard / compact（网格档）：编辑 桌面列数 + 间距
 *   - scroll（横滚行）：编辑 卡片定宽 px + 间距
 * 每档独立 save——对齐 PUT/:sizeClass 端点粒度 + 单档 audit（card_size.update）。
 *
 * 保存后约 ≤60s（SSR revalidate / 公开缓存 TTL）内前台渲染新尺寸（D-214-9 新鲜度有界）。
 */

import React, { useCallback, useEffect, useState, type CSSProperties } from 'react'
import {
  AdminButton,
  AdminCard,
  AdminInput,
  ErrorState,
  LoadingState,
  useToast,
} from '@resovo/admin-ui'
import type { CardSizeClass, CardSizeSettings } from '@resovo/types'
import { listCardSizes, updateCardSize, type CardSizeBody } from '@/lib/card-size/api'
import { CARD_SIZE_BOUNDS, validateCardSizeField, type CardSizeField } from '@/lib/card-size/validation'
import { ApiClientError } from '@/lib/api-client'

// ── 样式（沿用 LoginSessionsTab 范式）────────────────────────────────────────────

const SECTION_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  padding: '12px 0',
}

const FIELD_GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '160px 1fr',
  gap: '12px 16px',
  alignItems: 'center',
}

const FIELD_LABEL_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

const FIELD_HINT_STYLE: CSSProperties = {
  gridColumn: '2 / 3',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  marginTop: '-6px',
}

const ACTION_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  paddingTop: '12px',
}

const DIRTY_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

const ADVISORY_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  lineHeight: 1.6,
  padding: '4px 0',
}

// ── 档位元数据（D-214-2 封闭枚举展示文案）────────────────────────────────────────

const CLASS_META: Record<CardSizeClass, { label: string; subtitle: string }> = {
  standard: { label: '标准网格', subtitle: '首页特色 / 分类页 / 搜索结果（桌面列数 + 间距）' },
  compact: { label: '紧凑网格', subtitle: '详情页侧栏相关推荐（更密的列数 + 间距）' },
  scroll: { label: '横向滚动行', subtitle: '首页横滚卡片行（卡片定宽 px + 间距）' },
}

function describeError(err: unknown): string {
  if (err instanceof ApiClientError) return err.message
  return err instanceof Error ? err.message : '请稍后重试'
}

// ── NumberField：标签 + 数字输入 + hint/错误（消重）─────────────────────────────

interface NumberFieldProps {
  label: string
  value: string
  onChange: (next: string) => void
  field: CardSizeField
  hint: string
  suffix: string
  testId: string
}

function NumberField({ label, value, onChange, field, hint, suffix, testId }: NumberFieldProps) {
  const error = validateCardSizeField(field, Number(value))
  const { min, max } = CARD_SIZE_BOUNDS[field]
  return (
    <>
      <label style={FIELD_LABEL_STYLE}>{label}</label>
      <AdminInput
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={error !== null}
        suffix={suffix}
        data-testid={testId}
        aria-label={label}
        min={min}
        max={max}
      />
      <div style={{ ...FIELD_HINT_STYLE, ...(error !== null ? { color: 'var(--fg-danger)' } : null) }}>
        {error ?? hint}
      </div>
    </>
  )
}

// ── CardSizeClassCard：单档编辑卡（自管 draft / dirty / save）────────────────────

function CardSizeClassCard({ initial }: { initial: CardSizeSettings }) {
  const toast = useToast()
  const meta = CLASS_META[initial.sizeClass]
  const isScroll = initial.sizeClass === 'scroll'
  const sizeField: CardSizeField = isScroll ? 'cardWidthPx' : 'desktopColumns'

  const initialSize = (isScroll ? initial.cardWidthPx : initial.desktopColumns) ?? 0
  const [sizeInput, setSizeInput] = useState(String(initialSize))
  const [gapInput, setGapInput] = useState(String(initial.gapPx))
  const [baseline, setBaseline] = useState({ size: initialSize, gap: initial.gapPx })
  const [saving, setSaving] = useState(false)

  const dirty = Number(sizeInput) !== baseline.size || Number(gapInput) !== baseline.gap
  const hasError =
    validateCardSizeField(sizeField, Number(sizeInput)) !== null ||
    validateCardSizeField('gapPx', Number(gapInput)) !== null

  const handleSave = useCallback(async () => {
    if (hasError) return
    setSaving(true)
    try {
      const body: CardSizeBody = isScroll
        ? { cardWidthPx: Number(sizeInput), gapPx: Number(gapInput) }
        : { desktopColumns: Number(sizeInput), gapPx: Number(gapInput) }
      const updated = await updateCardSize(initial.sizeClass, body)
      const nextSize = (isScroll ? updated.cardWidthPx : updated.desktopColumns) ?? Number(sizeInput)
      setBaseline({ size: nextSize, gap: updated.gapPx })
      setSizeInput(String(nextSize))
      setGapInput(String(updated.gapPx))
      toast.push({ title: '已保存', description: `${meta.label} 尺寸已更新`, level: 'success' })
    } catch (err: unknown) {
      toast.push({ title: '保存失败', description: describeError(err), level: 'danger' })
    } finally {
      setSaving(false)
    }
  }, [hasError, isScroll, sizeInput, gapInput, initial.sizeClass, meta.label, toast])

  const handleReset = useCallback(() => {
    setSizeInput(String(baseline.size))
    setGapInput(String(baseline.gap))
  }, [baseline.size, baseline.gap])

  return (
    <AdminCard
      surface="plain"
      padding="md"
      header={{ title: meta.label, subtitle: meta.subtitle }}
      data-testid={`card-size-card-${initial.sizeClass}`}
    >
      <div style={FIELD_GRID_STYLE}>
        <NumberField
          label={isScroll ? '卡片宽度' : '桌面列数'}
          value={sizeInput}
          onChange={setSizeInput}
          field={sizeField}
          suffix={isScroll ? 'px' : '列'}
          hint={
            isScroll
              ? '横滚卡片定宽，范围 120–280px'
              : '桌面端列数（移动端固定 2 列、≥640px 3 列），范围 2–8'
          }
          testId={`card-size-${initial.sizeClass}-size`}
        />
        <NumberField
          label="卡片间距"
          value={gapInput}
          onChange={setGapInput}
          field="gapPx"
          suffix="px"
          hint="卡片之间的间距，范围 0–64px"
          testId={`card-size-${initial.sizeClass}-gap`}
        />
      </div>
      <div style={ACTION_ROW_STYLE}>
        <span style={DIRTY_STYLE} data-testid={`card-size-${initial.sizeClass}-dirty`}>
          {dirty ? '有未保存的修改' : '无未保存修改'}
        </span>
        <span style={{ display: 'inline-flex', gap: '8px' }}>
          <AdminButton
            variant="default"
            size="sm"
            disabled={!dirty || saving}
            onClick={handleReset}
            data-testid={`card-size-${initial.sizeClass}-reset`}
          >
            重置
          </AdminButton>
          <AdminButton
            variant="primary"
            size="sm"
            loading={saving}
            disabled={!dirty || hasError}
            onClick={() => void handleSave()}
            data-testid={`card-size-${initial.sizeClass}-save`}
          >
            保存
          </AdminButton>
        </span>
      </div>
    </AdminCard>
  )
}

// ── CardSizeTab：取数 + 渲染 3 档 ───────────────────────────────────────────────

export function CardSizeTab() {
  const [rows, setRows] = useState<CardSizeSettings[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listCardSizes()
      .then((data) => { if (!cancelled) setRows(data) })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error('卡片尺寸加载失败'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [retryKey])

  const refresh = useCallback(() => setRetryKey((k) => k + 1), [])

  if (loading && !rows) {
    return <div style={SECTION_STYLE} data-testid="card-size-tab"><LoadingState variant="skeleton" /></div>
  }

  if (error) {
    return (
      <div style={SECTION_STYLE} data-testid="card-size-tab">
        <ErrorState error={error} title="加载失败" onRetry={refresh} />
      </div>
    )
  }

  if (!rows) return null

  return (
    <div style={SECTION_STYLE} data-testid="card-size-tab">
      <p style={ADVISORY_STYLE}>
        调整前台视频卡片在网格 / 横滚行中的尺寸。保存后约 1 分钟内前台渲染新尺寸（SSR 新鲜度有界）。
        卡宽由容器宽度按列数弹性派生，无需写死。
      </p>
      {rows.map((row) => (
        <CardSizeClassCard key={`${row.sizeClass}-${retryKey}`} initial={row} />
      ))}
      <div style={ACTION_ROW_STYLE}>
        <span style={DIRTY_STYLE}>共 {rows.length} 档</span>
        <AdminButton variant="default" size="sm" onClick={refresh} data-testid="card-size-reload">
          重新加载
        </AdminButton>
      </div>
    </div>
  )
}
