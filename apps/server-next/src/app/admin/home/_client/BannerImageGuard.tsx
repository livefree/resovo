'use client'

/**
 * BannerImageGuard.tsx — Banner 横图警告级校验 + 安全区预览
 * （CHG-HOME-IMAGE-GUARD-BANNER / 方案 §6 / D-052-9 口径）
 *
 * imageUrl 防抖探测尺寸 → 规则警告条（**全部警告级，不阻断提交**）；
 * 探测失败 → 风险提醒（运营确认后仍可发布，§6.6）；
 * 探测成功 → desktop（21:9 首屏）/ mobile（4:5 窄屏）双安全区裁切预览（§6.4）。
 */

import { useEffect, useState, type CSSProperties } from 'react'
import { Pill } from '@resovo/admin-ui'
import {
  evaluateBannerImage,
  probeImageSize,
  type BannerImageWarning,
} from '@/lib/banners/image-guard'

const PROBE_DEBOUNCE_MS = 600

// ── 样式 ─────────────────────────────────────────────────────────

const WRAP_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const WARN_ROW_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '8px 10px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--state-warning-border, var(--border-subtle))',
  background: 'var(--state-warning-bg)',
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--fg-default)',
}

const WARN_ITEM_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

const OK_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--fg-muted)',
}

const PREVIEW_ROW_STYLE: CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'flex-start',
}

const PREVIEW_BOX_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--fg-muted)',
}

const DESKTOP_FRAME_STYLE: CSSProperties = {
  width: 252,
  aspectRatio: '21 / 9',
  borderRadius: 'var(--radius-sm)',
  overflow: 'hidden',
  border: '1px solid var(--border-default)',
  background: 'var(--bg-surface-sunken)',
}

const MOBILE_FRAME_STYLE: CSSProperties = {
  width: 96,
  aspectRatio: '4 / 5',
  borderRadius: 'var(--radius-sm)',
  overflow: 'hidden',
  border: '1px solid var(--border-default)',
  background: 'var(--bg-surface-sunken)',
}

const COVER_IMG_STYLE: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
}

// ── 探测状态 ─────────────────────────────────────────────────────

type ProbeState =
  | { readonly status: 'idle' }
  | { readonly status: 'probing' }
  // url 随探测结果保存：渲染预览用探测时刻值，防 prop 清空瞬时帧 img src=""
  | { readonly status: 'ok'; readonly url: string; readonly width: number; readonly height: number; readonly warnings: readonly BannerImageWarning[] }
  | { readonly status: 'failed' }

export interface BannerImageGuardProps {
  /** 待校验图 URL（空串 = 不探测） */
  readonly imageUrl: string
  /** 输入防抖（ms）；测试注入 0 免 fake timers */
  readonly debounceMs?: number
}

export function BannerImageGuard({ imageUrl, debounceMs = PROBE_DEBOUNCE_MS }: BannerImageGuardProps) {
  const [state, setState] = useState<ProbeState>({ status: 'idle' })

  useEffect(() => {
    const url = imageUrl.trim()
    if (!url) {
      setState({ status: 'idle' })
      return
    }
    setState({ status: 'probing' })
    let cancelled = false
    const timer = setTimeout(() => {
      probeImageSize(url)
        .then(({ width, height }) => {
          if (cancelled) return
          setState({ status: 'ok', url, width, height, warnings: evaluateBannerImage(width, height) })
        })
        .catch(() => {
          if (cancelled) return
          setState({ status: 'failed' })
        })
    }, debounceMs)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [imageUrl, debounceMs])

  if (state.status === 'idle' || state.status === 'probing') return null

  if (state.status === 'failed') {
    return (
      <div style={WRAP_STYLE} data-testid="banner-image-guard">
        <div style={WARN_ROW_STYLE} data-testid="banner-image-probe-failed">
          <div style={WARN_ITEM_STYLE}>
            <Pill variant="warn">探测失败</Pill>
            <span>无法读取外链图尺寸——请人工确认显示效果；确认后仍可发布（警告级不阻断）</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={WRAP_STYLE} data-testid="banner-image-guard">
      {state.warnings.length > 0 ? (
        <div style={WARN_ROW_STYLE} data-testid="banner-image-warnings">
          {state.warnings.map((w) => (
            <div key={w.code} style={WARN_ITEM_STYLE} data-testid={`banner-image-warning-${w.code}`}>
              <Pill variant="warn">警告</Pill>
              <span>{w.message}</span>
            </div>
          ))}
          <span style={OK_STYLE}>以上为建议项，不阻断保存（方案 §6 / D-052-9 宽松优先口径）</span>
        </div>
      ) : (
        <span style={OK_STYLE} data-testid="banner-image-ok">
          尺寸 {state.width}×{state.height}，符合建议（≥1280×720，比例 16:9–21:9）
        </span>
      )}

      {/* 安全区预览（§6.4）：同图双视口 object-fit cover 裁切示意 */}
      <div style={PREVIEW_ROW_STYLE} data-testid="banner-safe-area-preview">
        <div style={PREVIEW_BOX_STYLE}>
          <div style={DESKTOP_FRAME_STYLE}>
            {/* 装饰性预览，语义由说明文字承载 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={state.url} alt="" aria-hidden="true" style={COVER_IMG_STYLE} />
          </div>
          <span>Desktop 首屏（21:9 裁切）</span>
        </div>
        <div style={PREVIEW_BOX_STYLE}>
          <div style={MOBILE_FRAME_STYLE}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={state.url} alt="" aria-hidden="true" style={COVER_IMG_STYLE} />
          </div>
          <span>Mobile（4:5 中心裁切）</span>
        </div>
      </div>
    </div>
  )
}
