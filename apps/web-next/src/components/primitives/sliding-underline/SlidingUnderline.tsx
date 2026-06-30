'use client'

/**
 * SlidingUnderline — 单条下划线随 activeKey 在子项间滑动（HANDOFF-49-E，arch-reviewer claude-opus-4-8 契约）
 *
 * 替换「每项独立静态 span 显隐」为「单条 left+width 滑动」（对齐 Motion Spec：base 200ms ease-in-out）。
 *
 * 测量：`offsetLeft/offsetWidth`（相对 offsetParent，不受容器横滚影响，优于 getBoundingClientRect）。
 * SSR/首帧安全：span SSR 时 `opacity:0` + 无 transform（确定值，水合一致）；几何由 `useLayoutEffect`
 *   client 注入；首次定位 `transition:none`（直接出现在正确位置、不从 0 滑入），之后 activeKey 变化才滑动。
 * prefers-reduced-motion：`.sliding-underline` 类在 globals.css reduce 区置 transition:none（即时跳位）。
 */

import { useLayoutEffect, useState } from 'react'
import type { SlidingUnderlineProps } from './types'

const TRANSITION =
  'transform calc(var(--duration-base) * var(--motion-scale, 1)) var(--easing-ease-in-out), ' +
  'width calc(var(--duration-base) * var(--motion-scale, 1)) var(--easing-ease-in-out)'

interface Geometry {
  readonly left: number
  readonly width: number
}

export function SlidingUnderline({
  activeKey,
  registry,
  thicknessPx = 2,
  color = 'var(--accent-default)',
  offset = '0',
  insetPx = 0,
  insetPercent,
  testId,
}: SlidingUnderlineProps) {
  const [geo, setGeo] = useState<Geometry | null>(null)
  // 首次测量后下一帧才开启 transition（首屏直接定位、不从 0 滑入）
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    const target = activeKey === null ? null : (registry.get(activeKey) ?? null)
    if (target === null) {
      setGeo(null)
      return
    }
    const measure = () => {
      const w = target.offsetWidth
      const inset = insetPercent !== undefined ? (w * insetPercent) / 100 : insetPx
      setGeo({ left: target.offsetLeft + inset, width: Math.max(0, w - inset * 2) })
    }
    measure()
    // 字体加载 / 容器 resize / 兄弟项变宽（影响 offsetLeft）→ 重测
    const ro = new ResizeObserver(measure)
    ro.observe(target)
    registry.forEach((el) => {
      if (el !== null && el !== target) ro.observe(el)
    })
    return () => ro.disconnect()
  }, [activeKey, registry, insetPx, insetPercent])

  useLayoutEffect(() => {
    if (geo !== null && !ready) {
      const raf = requestAnimationFrame(() => setReady(true))
      return () => cancelAnimationFrame(raf)
    }
  }, [geo, ready])

  return (
    <span
      aria-hidden="true"
      data-testid={testId}
      className="sliding-underline"
      style={{
        position: 'absolute',
        bottom: offset,
        left: 0,
        height: `${thicknessPx}px`,
        width: geo !== null ? `${geo.width}px` : '0px',
        borderRadius: `${thicknessPx / 2}px`,
        background: color,
        transform: geo !== null ? `translateX(${geo.left}px)` : 'translateX(0)',
        opacity: geo !== null ? 1 : 0,
        transition: ready ? TRANSITION : 'none',
        pointerEvents: 'none',
      }}
    />
  )
}
