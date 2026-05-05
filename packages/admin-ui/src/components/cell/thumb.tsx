'use client'

/**
 * thumb.tsx — Thumb 共享组件实装（CHG-DESIGN-12 12B；v1.6 patch · CHG-SN-4-FIX-E 加 poster-lg；
 *   CHG-UX2-01/02 接入 admin-layout/cover.ts token + 加 poster-xl）
 *
 * 真源：thumb.types.ts（12A Opus PASS 契约 + v1.6 poster-lg 扩展 + CHG-UX2-01 poster-xl）；
 *       数值真源 packages/design-tokens/src/admin-layout/cover.ts（CHG-UX2-01）
 *
 * 实装契约（12A 一致性硬约束）：
 *   - 6 size variant：poster-sm 32×48 / poster-md 48×72 / poster-lg 80×120 /
 *     poster-xl 120×180 / banner-sm 64×36 / square-sm 28×28
 *   - src 非空 → <img object-fit:cover>；空 → placeholder span
 *   - decorative=true（默认） → alt='' + aria-hidden=true
 *   - decorative=false + alt 缺失 → dev warn
 *   - fallback ReactNode（src 空时优先于默认 placeholder）
 *   - loading 默认 'lazy'
 *
 * 固定 data attribute：data-thumb + data-size + data-state（has-src | placeholder）
 */
import React from 'react'
import type { ThumbProps, ThumbSize } from './thumb.types'

interface SizeSpec {
  /** width 走 CSS 变量字符串（var(--cover-*-w)） */
  readonly width: string
  /** height 走 CSS 变量字符串（var(--cover-*-h)） */
  readonly height: string
  readonly radius: string
  /** HTML width attribute（intrinsic size，必须与 design-tokens cover.ts 同步） */
  readonly wPx: number
  /** HTML height attribute（intrinsic size，必须与 design-tokens cover.ts 同步） */
  readonly hPx: number
}

/**
 * SIZE_PX：与 design-tokens/admin-layout/cover.ts 数值同步的 number 表。
 *
 * 必须存在的原因：HTML `<img width height>` attribute 不接受 var()，
 * 必须传 number。img 缺失 HTML w/h attribute 时浏览器 fallback 到图源
 * naturalWidth/Height 决定 intrinsic size，flex algorithm 据此算 main size，
 * 导致 img 在 flex item 位置 width 退化（实测从期望 48 → 退化到 ~37）。
 *
 * 旧版 server `TableImageCell` 用 next/image，会自动注入 HTML w/h attribute
 * 不踩此坑；admin-ui Thumb 用裸 <img> 必须显式传。
 *
 * 同步守卫：thumb.test.tsx 有 sanity test 校验本表与 design-tokens 一致。
 */
const SIZE_PX: Record<ThumbSize, { w: number; h: number }> = {
  'poster-sm': { w: 32, h: 48 },
  'poster-md': { w: 48, h: 72 },
  'poster-lg': { w: 80, h: 120 },
  'poster-xl': { w: 120, h: 180 },
  'banner-sm': { w: 64, h: 36 },
  'square-sm': { w: 28, h: 28 },
}

function sizeSpec(size: ThumbSize): SizeSpec {
  const px = SIZE_PX[size]
  switch (size) {
    case 'poster-md': return { width: 'var(--cover-poster-md-w)', height: 'var(--cover-poster-md-h)', radius: 'var(--radius-sm)', wPx: px.w, hPx: px.h }
    case 'poster-lg': return { width: 'var(--cover-poster-lg-w)', height: 'var(--cover-poster-lg-h)', radius: 'var(--radius-sm)', wPx: px.w, hPx: px.h }
    case 'poster-xl': return { width: 'var(--cover-poster-xl-w)', height: 'var(--cover-poster-xl-h)', radius: 'var(--radius-md)', wPx: px.w, hPx: px.h }
    case 'banner-sm': return { width: 'var(--cover-banner-sm-w)', height: 'var(--cover-banner-sm-h)', radius: 'var(--radius-sm)', wPx: px.w, hPx: px.h }
    case 'square-sm': return { width: 'var(--cover-square-sm-w)', height: 'var(--cover-square-sm-h)', radius: 'var(--radius-md)', wPx: px.w, hPx: px.h }
    case 'poster-sm':
    default:
      return { width: 'var(--cover-poster-sm-w)', height: 'var(--cover-poster-sm-h)', radius: 'var(--radius-sm)', wPx: px.w, hPx: px.h }
  }
}

export function Thumb({
  src,
  size = 'poster-sm',
  alt,
  decorative = true,
  fallback,
  loading = 'lazy',
  testId,
}: ThumbProps): React.ReactElement {
  // 12A SHOULD：decorative=false + alt 缺失 → dev warn
  if (process.env.NODE_ENV !== 'production' && !decorative && !alt) {
    // eslint-disable-next-line no-console
    console.warn(
      `[Thumb] decorative=false but alt is empty/missing. ` +
      `Pass alt explicitly for informational images (a11y).`,
    )
  }

  const spec = sizeSpec(size)
  // CHG-UX2-03f 真根因修复：img 必须带 HTML width/height attribute（见 §SIZE_PX 注释）。
  // has-src 分支 root 用 display: block 配合（避免 inline-flex 父 + replaced child
  // 的 layout 噪音；inline-flex 也能工作但 block 更确定性）。
  const rootStyleBase: React.CSSProperties = {
    width: spec.width,
    height: spec.height,
    borderRadius: spec.radius,
    background: 'var(--bg-surface-elevated)',
    overflow: 'hidden',
    flexShrink: 0,
  }

  const hasSrc = typeof src === 'string' && src.length > 0

  if (hasSrc) {
    return (
      <span
        data-thumb
        data-size={size}
        data-state="has-src"
        data-testid={testId}
        style={{ ...rootStyleBase, display: 'block' }}
      >
        <img
          src={src}
          width={spec.wPx}
          height={spec.hPx}
          alt={decorative ? '' : (alt ?? '')}
          aria-hidden={decorative ? true : undefined}
          loading={loading}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </span>
    )
  }

  // src 空 → fallback ReactNode 或默认 placeholder（保留 inline-flex 居中文字）
  return (
    <span
      data-thumb
      data-size={size}
      data-state="placeholder"
      data-testid={testId}
      aria-label={decorative ? undefined : (alt ?? '无封面')}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      style={{
        ...rootStyleBase,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {fallback ?? null}
    </span>
  )
}
