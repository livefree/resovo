'use client'

/**
 * source-logo-badge.tsx — 外部源品牌 Logo 徽标原语（ADR-172 AMENDMENT 2 / META-14-A）
 *
 * 真源：enrichment-badge.types.ts（arch-reviewer Opus PASS 契约）
 *
 * 实装契约：
 *   - 渲染 <img>（data-URI logo，自包含）；matched=全彩 / candidate=全彩+琥珀小点 / absent=灰显
 *   - absent 灰显 = filter grayscale(1) + opacity var(--logo-absent-opacity)（零硬编码颜色）
 *   - candidate 小点颜色 = var(--state-warning-fg)（复用 token / 仅 douban/bangumi 出现）
 *   - a11y：img alt + 外层 title 属性（hover tooltip，修复旧契约缺口）；title 省略则据 source+state 派生
 *   - 命中且有 href → 包 <a target=_blank rel=noopener noreferrer>；absent/无 href → 裸渲染
 *
 * 固定 data attribute：data-source-logo + data-source + data-state + data-size
 */
import React from 'react'
import { SOURCE_LOGO_DATA_URI, SOURCE_LABEL } from './enrichment-logos'
import type { SourceLogoBadgeProps, SourceMatchState } from './enrichment-badge.types'

const SIZE_PX: Record<'sm' | 'md', number> = { sm: 16, md: 20 }

function stateText(state: SourceMatchState): string {
  switch (state) {
    case 'matched':   return '已匹配'
    case 'candidate': return '候选'
    case 'absent':
    default:          return '未匹配'
  }
}

const DOT_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: '-2px',
  right: '-2px',
  width: '6px',
  height: '6px',
  borderRadius: '50%',
  background: 'var(--state-warning-fg)',
  pointerEvents: 'none',
}

export function SourceLogoBadge({
  source,
  state,
  href,
  size = 'sm',
  title,
  testId,
}: SourceLogoBadgeProps): React.ReactElement {
  const px = SIZE_PX[size]
  const label = title ?? `${SOURCE_LABEL[source]}：${stateText(state)}`
  const linked = state !== 'absent' && !!href

  const imgStyle: React.CSSProperties = {
    width: `${px}px`,
    height: `${px}px`,
    display: 'block',
    borderRadius: 'var(--radius-sm)',
    // absent 灰显：grayscale 滤镜（非颜色字面量）+ 语义 opacity token
    ...(state === 'absent'
      ? { filter: 'grayscale(1)', opacity: 'var(--logo-absent-opacity)' }
      : null),
  }

  const inner = (
    <span style={{ position: 'relative', display: 'inline-flex', lineHeight: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- data-URI 内联 logo，无需 next/image 优化 */}
      <img src={SOURCE_LOGO_DATA_URI[source]} alt={label} style={imgStyle} />
      {state === 'candidate' && <span aria-hidden="true" data-candidate-dot style={DOT_STYLE} />}
    </span>
  )

  const commonProps = {
    'data-source-logo': '',
    'data-source': source,
    'data-state': state,
    'data-size': size,
    'data-testid': testId,
    title: label,
    style: { display: 'inline-flex', alignItems: 'center' } as React.CSSProperties,
  }

  if (linked) {
    return (
      <a {...commonProps} href={href} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    )
  }
  return <span {...commonProps}>{inner}</span>
}
