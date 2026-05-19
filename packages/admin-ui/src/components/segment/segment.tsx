'use client'

/**
 * segment.tsx — Segment primitive 实施
 *
 * 真源：ADR-124 + screens-3.jsx:423-427 + reference.md §228/§886
 * 任务卡：CHG-SN-7-REDO-02-PRE-CARD-PRIMITIVE-A
 * Opus arch-reviewer 评 A / 0 红线 / 2 黄线（已落地）+ 2 advisory（留消费方）
 *
 * 关键设计：
 *   - WAI-ARIA tabs pattern：role="tablist" + role="tab" + activate-on-focus（D5）
 *   - roving tabIndex：仅 active 项 tabIndex=0 / 其余 -1（Y2 + 仅键盘触发 focus）
 *   - 键盘交互：←/→ 循环 / Home/End 跳跃 / 跳过 disabled 项
 *   - badge 在 active 项颜色反转（Y1：active bg 浅色 + accent-soft badge 易糊 → 反转）
 *   - 0 硬编码颜色（全 CSS 变量 / token）
 *
 * 不在范围（advisory）：
 *   - AD1 `99+` 自动格式化（留消费方 / formatBadgeCount util）
 *   - AD2 disabled 容器保留 tablist 语义（实施）
 *
 * 用法：
 *   ```tsx
 *   <Segment
 *     items={[
 *       { value: 'bad_source', label: '失效源举报', badge: 8 },
 *       { value: 'wish_list', label: '求片', badge: 3 },
 *     ]}
 *     value={segment}
 *     onChange={setSegment}
 *     aria-label="投稿分类"
 *   />
 *   ```
 */

import React, { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import type { SegmentItem, SegmentProps, SegmentSize } from './segment.types'

// ── 尺寸 token ────────────────────────────────────────────────────

const SIZE_PADDING: Record<SegmentSize, string> = {
  sm: '2px 8px',
  md: '4px 10px',
  lg: '6px 12px',
}

const SIZE_FONT: Record<SegmentSize, string> = {
  sm: 'var(--font-size-xxs)',
  md: 'var(--font-size-xs)',
  lg: 'var(--font-size-sm)',
}

// ── 容器 / 按钮 / badge 样式 ─────────────────────────────────────

const CONTAINER_STYLE: CSSProperties = {
  display: 'inline-flex',
  gap: '2px',
  padding: '2px',
  background: 'var(--bg-subtle, var(--bg-surface))',
  borderRadius: 'var(--radius-md, 8px)',
  border: '1px solid var(--border-subtle)',
  alignItems: 'center',
}

function buttonStyle(size: SegmentSize, active: boolean, disabled: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: SIZE_PADDING[size],
    fontSize: SIZE_FONT[size],
    fontFamily: 'inherit',
    fontWeight: active ? 500 : 400,
    color: active ? 'var(--fg-default)' : 'var(--fg-muted)',
    background: active ? 'var(--bg-surface-elevated, var(--bg-surface))' : 'transparent',
    border: 'none',
    borderRadius: 'var(--radius-sm, 6px)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    boxShadow: active ? 'var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.08))' : 'none',
    transition: 'background 120ms ease, color 120ms ease',
    whiteSpace: 'nowrap',
  }
}

function badgeStyle(active: boolean): CSSProperties {
  // Y1：active 项 badge 颜色反转（active bg 浅色 / badge 不应再用 accent-soft 糊在一起）
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '16px',
    height: '16px',
    padding: '0 5px',
    background: active ? 'var(--accent-default)' : 'var(--accent-soft, var(--bg-subtle))',
    color: active ? 'var(--accent-on, var(--fg-on-accent))' : 'var(--accent-default)',
    borderRadius: 'var(--radius-pill, 9999px)',
    fontSize: 'var(--font-size-xxs)',
    fontWeight: 500,
    marginLeft: '4px',
    lineHeight: 1,
  }
}

// ── 工具函数 ──────────────────────────────────────────────────────

function findEnabledIndex(
  items: readonly SegmentItem[],
  containerDisabled: boolean,
  from: number,
  direction: 1 | -1,
): number {
  if (items.length === 0) return -1
  let idx = from
  for (let attempts = 0; attempts < items.length; attempts++) {
    idx = (idx + direction + items.length) % items.length
    if (idx === from) return from
    const item = items[idx]
    if (!containerDisabled && !item.disabled) return idx
  }
  return from
}

function findFirstEnabled(items: readonly SegmentItem[], containerDisabled: boolean): number {
  return items.findIndex((it) => !containerDisabled && !it.disabled)
}

function findLastEnabled(items: readonly SegmentItem[], containerDisabled: boolean): number {
  for (let i = items.length - 1; i >= 0; i--) {
    if (!containerDisabled && !items[i].disabled) return i
  }
  return -1
}

// ── 主组件 ────────────────────────────────────────────────────────

export function Segment({
  items,
  value,
  onChange,
  size = 'md',
  disabled = false,
  className,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: SegmentProps): React.ReactElement {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  // Y2：仅键盘触发时 focus（不偷页面初始焦点）
  const focusOnNextRender = useRef(false)
  const [focusVisible, setFocusVisible] = useState<number | null>(null)

  useEffect(() => {
    if (!focusOnNextRender.current) return
    focusOnNextRender.current = false
    const idx = items.findIndex((it) => it.value === value)
    if (idx >= 0) tabRefs.current[idx]?.focus()
  })

  const select = useCallback(
    (item: SegmentItem) => {
      if (disabled || item.disabled || item.value === value) return
      onChange(item.value)
    },
    [disabled, onChange, value],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return
      const currentIdx = items.findIndex((it) => it.value === value)
      let nextIdx = -1

      if (e.key === 'ArrowRight') {
        nextIdx = findEnabledIndex(items, disabled, currentIdx, 1)
      } else if (e.key === 'ArrowLeft') {
        nextIdx = findEnabledIndex(items, disabled, currentIdx, -1)
      } else if (e.key === 'Home') {
        nextIdx = findFirstEnabled(items, disabled)
      } else if (e.key === 'End') {
        nextIdx = findLastEnabled(items, disabled)
      } else {
        return
      }

      if (nextIdx >= 0 && nextIdx !== currentIdx) {
        e.preventDefault()
        focusOnNextRender.current = true
        onChange(items[nextIdx].value)
      }
    },
    [disabled, items, onChange, value],
  )

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      aria-label={ariaLabel}
      data-admin-segment
      data-size={size}
      data-disabled={disabled ? '' : undefined}
      className={className}
      style={CONTAINER_STYLE}
      onKeyDown={handleKeyDown}
      data-testid={testId}
    >
      {items.map((item, idx) => {
        const active = item.value === value
        const itemDisabled = disabled || (item.disabled ?? false)
        return (
          <button
            key={item.value}
            ref={(el) => { tabRefs.current[idx] = el }}
            type="button"
            role="tab"
            aria-selected={active}
            aria-disabled={itemDisabled || undefined}
            tabIndex={active ? 0 : -1}
            disabled={itemDisabled}
            onClick={() => select(item)}
            onFocus={() => setFocusVisible(idx)}
            onBlur={() => setFocusVisible((prev) => (prev === idx ? null : prev))}
            style={{
              ...buttonStyle(size, active, itemDisabled),
              outline: focusVisible === idx ? '2px solid var(--accent-default)' : 'none',
              outlineOffset: '2px',
            }}
            data-value={item.value}
            data-active={active ? '' : undefined}
            data-segment-item
          >
            <span>{item.label}</span>
            {item.badge !== undefined && (
              <span style={badgeStyle(active)} data-segment-badge aria-hidden="true">
                {item.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
