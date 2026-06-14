'use client'

/**
 * metadata-provider-icon.tsx — 单来源图标原语 MetadataProviderIcon（ADR-201 / META-33-A）
 *
 * 真源：metadata-status.types.ts（arch-reviewer Opus CONDITIONAL-PASS 契约）。
 *
 * 承载 `MetadataProviderState` 五态（DEV-33-1：新建而非复用退役 SourceLogoBadge）：
 *   - applied        全彩 logo / 无角标
 *   - candidate      全彩 logo / 黄点（--state-warning-fg）
 *   - problem        全彩 logo / 红点（--state-error-fg，⚠ error 非 danger，R2）
 *   - missing        灰显（grayscale + --logo-absent-opacity）/ 无角标
 *   - not_applicable 灰显 / 无角标（tooltip 文案含「不适用」）
 *
 * 复用 enrichment-logos.ts 的 logo 数据资产（SOURCE_LOGO_DATA_URI / SOURCE_LABEL），
 * **不复用** SourceLogoBadge 组件（红线 R1：退役组件不得新增消费点）。
 *
 * 固定 data attribute：data-metadata-provider-icon + data-provider + data-state + data-size
 */
import React from 'react'
import { SOURCE_LOGO_DATA_URI, SOURCE_LABEL } from '../enrichment-badge/enrichment-logos'
import type { MetadataIconSize, MetadataProviderIconProps } from './metadata-status.types'
import { ICON_DOT_TOKEN, PROVIDER_STATE_LABEL, PROVIDER_STATE_VISUAL } from './metadata-status-labels'

const SIZE_PX: Record<MetadataIconSize, number> = { sm: 16, md: 20, lg: 24 }

/** 角标几何（6px / 右上）。本地定义不 import 退役 source-logo-badge（R1）。 */
const DOT_STYLE_BASE: React.CSSProperties = {
  position: 'absolute',
  top: '-2px',
  right: '-2px',
  width: '6px',
  height: '6px',
  borderRadius: '50%',
  pointerEvents: 'none',
}

export function MetadataProviderIcon({
  provider,
  state,
  href,
  size = 'sm',
  title,
  testId,
}: MetadataProviderIconProps): React.ReactElement {
  const px = SIZE_PX[size]
  const visual = PROVIDER_STATE_VISUAL[state]
  const label = title ?? `${SOURCE_LABEL[provider]}：${PROVIDER_STATE_LABEL[state]}`
  const linked = !!href && state !== 'missing' && state !== 'not_applicable'

  const imgStyle: React.CSSProperties = {
    width: `${px}px`,
    height: `${px}px`,
    display: 'block',
    borderRadius: 'var(--radius-sm)',
    // 灰显：grayscale 滤镜（非颜色字面量）+ 语义 opacity token
    ...(visual.grayscale
      ? { filter: 'grayscale(1)', opacity: 'var(--logo-absent-opacity)' }
      : null),
  }

  const dotStyle: React.CSSProperties | null = visual.dot
    ? { ...DOT_STYLE_BASE, background: ICON_DOT_TOKEN[visual.dot] }
    : null

  const inner = (
    <span style={{ position: 'relative', display: 'inline-flex', lineHeight: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- data-URI 内联 logo，无需 next/image 优化 */}
      <img src={SOURCE_LOGO_DATA_URI[provider]} alt={label} style={imgStyle} />
      {dotStyle && <span aria-hidden="true" data-state-dot={visual.dot ?? undefined} style={dotStyle} />}
    </span>
  )

  const commonProps = {
    'data-metadata-provider-icon': '',
    'data-provider': provider,
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
