'use client'

/**
 * CardSizeTab — 「前台展示」站点设置 Tab：前台卡片尺寸体系编辑面板（SEQ-20260622-03 Phase 3 / ADR-214/215）
 *
 * 消费端点（ADR-215 D-215-1/2，经 @/lib/card-size/api）：
 *   - GET  /admin/card-sizes           → 2 档全量
 *   - PUT  /admin/card-sizes/:sizeClass → 全替换该档可编辑投影
 *
 * 2 档封闭枚举（D-214-2 + Amendment A1：compact 废弃，单位统一为卡宽）：
 *   - standard（网格档）：编辑 卡片宽度 px + 间距（size-driven，列数由容器宽派生）
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

// ── 预览样式（WYSIWYG 占位网格；主题 CSS 变量、零硬编码色）───────────────────────

const PREVIEW_WRAP_STYLE: CSSProperties = {
  marginTop: '16px',
  padding: '12px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
}

const PREVIEW_LABEL_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xxs)',
  color: 'var(--fg-muted)',
  marginBottom: '8px',
}

/** 2:3 占位卡（模拟海报比例；--bg-surface-raised 填充 + 边框，零硬编码色） */
const PREVIEW_CARD_STYLE: CSSProperties = {
  aspectRatio: '2 / 3',
  background: 'var(--bg-surface-raised)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
}

// ── 档位元数据（D-214-2 封闭枚举展示文案）────────────────────────────────────────

const CLASS_META: Record<CardSizeClass, { label: string; subtitle: string }> = {
  standard: { label: '标准网格', subtitle: '首页特色 / 分类页 / 搜索结果（卡片宽度 + 间距，列数自动）' },
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

// ── CardSizePreview：实时 WYSIWYG 预览（消费 draft 值，纯 CSS 占位网格）──────────
//
// 后台 server-next 自包含——**不跨 app import 前台 CardGrid/VideoCard**（边界 + 前台 context 依赖）；
// 仅以占位方块复刻网格/横滚的列数·间距·卡宽布局语义，随表单 draft 实时重渲。

/** 预览占位卡数（grid auto-fill 自动排列 / scroll 横排，够看清卡宽 + 间距） */
const PREVIEW_GRID_CARDS = 8
/** scroll 档预览占位卡数（够看清定宽 + 横滚 + gap） */
const PREVIEW_SCROLL_CARDS = 6
/** 卡宽降级兜底（NaN/空输入，与 scroll 默认同口径） */
const PREVIEW_FALLBACK_W = 170

interface CardSizePreviewProps {
  sizeClass: CardSizeClass
  isScroll: boolean
  /** 卡片宽度 px（draft，全档同构；Amendment A1 单位统一为卡宽） */
  cardWidthPx: number
  /** 间距 px（draft） */
  gapPx: number
}

function CardSizePreview({ sizeClass, isScroll, cardWidthPx, gapPx }: CardSizePreviewProps) {
  const gap = Number.isFinite(gapPx) && gapPx >= 0 ? gapPx : 0
  const w = Number.isFinite(cardWidthPx) && cardWidthPx > 0 ? Math.trunc(cardWidthPx) : PREVIEW_FALLBACK_W

  if (isScroll) {
    return (
      <div style={PREVIEW_WRAP_STYLE} data-testid={`card-size-${sizeClass}-preview`}>
        <div style={PREVIEW_LABEL_STYLE}>预览（横滚行 · 卡宽 {w}px · 间距 {gap}px）</div>
        <div
          data-testid={`card-size-${sizeClass}-preview-track`}
          style={{ display: 'flex', gap: `${gap}px`, overflowX: 'auto', paddingBottom: '4px' }}
        >
          {Array.from({ length: PREVIEW_SCROLL_CARDS }).map((_, i) => (
            <div key={i} style={{ ...PREVIEW_CARD_STYLE, width: `${w}px`, flex: '0 0 auto' }} />
          ))}
        </div>
      </div>
    )
  }

  // standard：size-driven 网格（auto-fill，卡宽恒定最小、列数由预览容器宽自动派生，D-214-A1-1）
  return (
    <div style={PREVIEW_WRAP_STYLE} data-testid={`card-size-${sizeClass}-preview`}>
      <div style={PREVIEW_LABEL_STYLE}>
        预览（桌面 size-driven · 卡宽 {w}px · 间距 {gap}px；列数随容器宽自动 / 移动端 2 列 / ≥640px 3 列）
      </div>
      <div
        data-testid={`card-size-${sizeClass}-preview-track`}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(min(${w}px, 100%), 1fr))`,
          gap: `${gap}px`,
        }}
      >
        {Array.from({ length: PREVIEW_GRID_CARDS }).map((_, i) => (
          <div key={i} style={PREVIEW_CARD_STYLE} />
        ))}
      </div>
    </div>
  )
}

// ── CardSizeClassCard：单档编辑卡（自管 draft / dirty / save）────────────────────

function CardSizeClassCard({ initial }: { initial: CardSizeSettings }) {
  const toast = useToast()
  const meta = CLASS_META[initial.sizeClass]
  const isScroll = initial.sizeClass === 'scroll'
  // Amendment A1：单位统一为卡宽（standard size-driven / scroll 横滚）；desktopColumns 护栏本轮不暴露编辑
  const sizeField: CardSizeField = 'cardWidthPx'

  const initialSize = initial.cardWidthPx ?? 0
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
      const body: CardSizeBody = { cardWidthPx: Number(sizeInput), gapPx: Number(gapInput) }
      const updated = await updateCardSize(initial.sizeClass, body)
      const nextSize = updated.cardWidthPx ?? Number(sizeInput)
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
          label="卡片宽度"
          value={sizeInput}
          onChange={setSizeInput}
          field={sizeField}
          suffix="px"
          hint={
            isScroll
              ? '横滚卡片定宽，范围 120–400px'
              : 'size-driven 卡片宽度（列数由容器宽自动派生 / 移动端 2 列、≥640px 3 列），范围 120–400px'
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
      <CardSizePreview
        sizeClass={initial.sizeClass}
        isScroll={isScroll}
        cardWidthPx={Number(sizeInput)}
        gapPx={Number(gapInput)}
      />
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
        网格档为 size-driven：设定卡片宽度，列数由容器宽度自动派生（无需写死列数）。
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
