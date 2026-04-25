/**
 * drag.ts — HANDOFF-03 MiniPlayer 交互库（纯 DOM + pointer events）
 *
 * 实现 B 站风浮窗的三项交互：
 *   1. 顶部 drag handle 拖拽 → transform: translate3d 实时更新 → 松手吸附最近角 + spring 260ms
 *   2. 右下 resize handle 缩放 → 保持 16:9 → clampWidth 到 [240, 480] → 松手持久化
 *   3. window.resize 越界 re-snap → 浮窗超出视口时自动吸附到最近角
 *
 * 不依赖 React；由 MiniPlayer.tsx 的 effect 在 mount/unmount 时 attach/cleanup。
 * 参考实现：docs/handoff_20260422/designs/Global Shell.html:759-820
 */

import {
  MINI_GEOMETRY_CONSTRAINTS,
  clampWidth,
  computeDockPosition,
  deriveHeightFromWidth,
  nearestCorner,
  type MiniGeometryV1,
} from '@/stores/_persist/mini-geometry'

const { MIN_WIDTH, MAX_WIDTH, DOCK_MARGIN, SNAP_DURATION_MS, SNAP_EASING } = MINI_GEOMETRY_CONSTRAINTS

export interface DragAttachOptions {
  readonly container: HTMLElement
  readonly dragHandle: HTMLElement
  readonly resizeHandle: HTMLElement
  readonly getGeometry: () => MiniGeometryV1
  readonly commitGeometry: (geom: MiniGeometryV1) => void
  /**
   * 可选：交互状态变化回调（true=用户正在 drag/resize 中；false=已 commit）。
   * 消费方（如 MiniPlayer）用此标志在 useLayoutEffect 里跳过 style 覆写，
   * 避免打断 drag.ts 在 commit 时设置的 spring transition。
   * false 在 commit 完成后延迟 snap 动画时长再触发（避免动画中途被覆盖）。
   */
  readonly onInteractionChange?: (interacting: boolean) => void
}

/**
 * attachMiniPlayerDrag — 在 container 上挂 pointer events 拖拽 + 缩放。
 * 拖拽过程中用 transform + 实时跟随 pointer，松手时吸附 + spring 动画 + commitGeometry。
 * 返回 cleanup 函数（必须在 unmount 时调用）。
 */
export function attachMiniPlayerDrag(options: DragAttachOptions): () => void {
  const { container, dragHandle, resizeHandle, getGeometry, commitGeometry, onInteractionChange } = options
  let interactionEndTimer: ReturnType<typeof setTimeout> | null = null

  // 共用的 drag state（drag 和 resize 互斥，同一时刻只有一种操作）
  let pointerId: number | null = null
  let mode: 'drag' | 'resize' | null = null
  let startPointerX = 0
  let startPointerY = 0
  let startLeft = 0
  let startTop = 0
  let startWidth = 0
  let rafId: number | null = null
  let nextLeft = 0
  let nextTop = 0
  let nextWidth = 0

  // ── drag handle → 拖拽 ──────────────────────────────────────────
  function notifyInteractionStart(): void {
    if (interactionEndTimer !== null) {
      clearTimeout(interactionEndTimer)
      interactionEndTimer = null
    }
    onInteractionChange?.(true)
  }

  function notifyInteractionEnd(): void {
    // 延迟一个 snap 动画时长再通知 end，保护 spring 动画完成（加分建议 B）
    if (interactionEndTimer !== null) clearTimeout(interactionEndTimer)
    interactionEndTimer = setTimeout(() => {
      interactionEndTimer = null
      onInteractionChange?.(false)
    }, SNAP_DURATION_MS + 20)
  }

  const onDragPointerDown = (e: PointerEvent): void => {
    if (pointerId !== null) return // 已在其他交互中
    if (e.button !== 0) return      // 仅左键 / 主触
    // 按钮 / 链接等可交互元素发出的事件不启动拖拽（避免 React 合成事件 stopPropagation 竞争问题）
    if ((e.target as HTMLElement).closest('button, a, [role="button"], [data-no-drag]')) return
    pointerId = e.pointerId
    mode = 'drag'
    dragHandle.setPointerCapture(e.pointerId)
    notifyInteractionStart()

    const rect = container.getBoundingClientRect()
    startLeft = rect.left
    startTop = rect.top
    startPointerX = e.clientX
    startPointerY = e.clientY

    // 关闭 spring transition，实时跟随
    container.style.transition = 'none'
    e.preventDefault()
  }

  const onResizePointerDown = (e: PointerEvent): void => {
    if (pointerId !== null) return
    if (e.button !== 0) return
    pointerId = e.pointerId
    mode = 'resize'
    resizeHandle.setPointerCapture(e.pointerId)
    notifyInteractionStart()

    const rect = container.getBoundingClientRect()
    startLeft = rect.left
    startTop = rect.top
    startWidth = rect.width
    startPointerX = e.clientX
    startPointerY = e.clientY

    container.style.transition = 'none'
    e.preventDefault()
    e.stopPropagation()
  }

  const onPointerMove = (e: PointerEvent): void => {
    if (pointerId === null || e.pointerId !== pointerId) return
    if (mode === 'drag') {
      nextLeft = startLeft + (e.clientX - startPointerX)
      nextTop = startTop + (e.clientY - startPointerY)
      schedulePaint()
    } else if (mode === 'resize') {
      // 右下缩放：沿 pointer 移动量调整 width，height 由 16:9 派生
      const delta = Math.max(e.clientX - startPointerX, e.clientY - startPointerY)
      nextWidth = clampWidth(startWidth + delta)
      schedulePaint()
    }
  }

  const onPointerUp = (e: PointerEvent): void => {
    if (pointerId === null || e.pointerId !== pointerId) return
    const wasMode = mode
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    // 释放 pointer capture
    if (mode === 'drag' && dragHandle.hasPointerCapture(e.pointerId)) {
      dragHandle.releasePointerCapture(e.pointerId)
    } else if (mode === 'resize' && resizeHandle.hasPointerCapture(e.pointerId)) {
      resizeHandle.releasePointerCapture(e.pointerId)
    }
    pointerId = null
    mode = null

    if (wasMode === 'drag') {
      commitDrag()
    } else if (wasMode === 'resize') {
      commitResize()
    }
    notifyInteractionEnd()
  }

  function schedulePaint(): void {
    if (rafId !== null) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      if (mode === 'drag') {
        // 使用 left/top（fixed 定位），不用 transform，便于 commit 时直接计算 corner
        container.style.left = `${nextLeft}px`
        container.style.top = `${nextTop}px`
      } else if (mode === 'resize') {
        container.style.width = `${nextWidth}px`
        container.style.height = `${deriveHeightFromWidth(nextWidth)}px`
      }
    })
  }

  function commitDrag(): void {
    // 计算浮窗中心点 → nearestCorner → spring 动画 → setGeometry
    const rect = container.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const vw = window.innerWidth
    const vh = window.innerHeight
    const corner = nearestCorner(centerX, centerY, vw, vh)
    const current = getGeometry()
    const nextGeom: MiniGeometryV1 = { ...current, corner }
    const { left, top } = computeDockPosition(nextGeom, vw, vh)

    // 先应用 spring transition 让浮窗吸附动画生效
    container.style.transition = `left ${SNAP_DURATION_MS}ms ${SNAP_EASING}, top ${SNAP_DURATION_MS}ms ${SNAP_EASING}`
    container.style.left = `${left}px`
    container.style.top = `${top}px`

    commitGeometry(nextGeom)
  }

  function commitResize(): void {
    const rect = container.getBoundingClientRect()
    const width = clampWidth(rect.width)
    const height = deriveHeightFromWidth(width)
    const current = getGeometry()
    const nextGeom: MiniGeometryV1 = { ...current, width, height }
    // resize 结束后不改 corner，仅按当前 corner 重新 dock
    const vw = window.innerWidth
    const vh = window.innerHeight
    const { left, top } = computeDockPosition(nextGeom, vw, vh)

    container.style.transition = `left ${SNAP_DURATION_MS}ms ${SNAP_EASING}, top ${SNAP_DURATION_MS}ms ${SNAP_EASING}, width ${SNAP_DURATION_MS}ms ${SNAP_EASING}, height ${SNAP_DURATION_MS}ms ${SNAP_EASING}`
    container.style.left = `${left}px`
    container.style.top = `${top}px`
    container.style.width = `${width}px`
    container.style.height = `${height}px`

    commitGeometry(nextGeom)
  }

  dragHandle.addEventListener('pointerdown', onDragPointerDown)
  resizeHandle.addEventListener('pointerdown', onResizePointerDown)
  dragHandle.addEventListener('pointermove', onPointerMove)
  resizeHandle.addEventListener('pointermove', onPointerMove)
  dragHandle.addEventListener('pointerup', onPointerUp)
  resizeHandle.addEventListener('pointerup', onPointerUp)
  dragHandle.addEventListener('pointercancel', onPointerUp)
  resizeHandle.addEventListener('pointercancel', onPointerUp)

  return () => {
    if (rafId !== null) cancelAnimationFrame(rafId)
    if (interactionEndTimer !== null) clearTimeout(interactionEndTimer)
    dragHandle.removeEventListener('pointerdown', onDragPointerDown)
    resizeHandle.removeEventListener('pointerdown', onResizePointerDown)
    dragHandle.removeEventListener('pointermove', onPointerMove)
    resizeHandle.removeEventListener('pointermove', onPointerMove)
    dragHandle.removeEventListener('pointerup', onPointerUp)
    resizeHandle.removeEventListener('pointerup', onPointerUp)
    dragHandle.removeEventListener('pointercancel', onPointerUp)
    resizeHandle.removeEventListener('pointercancel', onPointerUp)
  }
}

/**
 * attachViewportResizeWatcher — 监听 window.resize，检测浮窗是否因视口缩小而越界。
 * 越界判断：当前 corner 的 dock 位置若使浮窗 left<0 或 top<0（视口过小），
 *   则重新计算 nearestCorner 并 commitGeometry 触发 re-snap。
 * 同时确保在 ANY corner 下浮窗完全落入视口可见区域。
 */
export function attachViewportResizeWatcher(
  container: HTMLElement,
  getGeometry: () => MiniGeometryV1,
  commitGeometry: (geom: MiniGeometryV1) => void,
): () => void {
  let rafId: number | null = null

  const onResize = (): void => {
    if (rafId !== null) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      const geom = getGeometry()
      const vw = window.innerWidth
      const vh = window.innerHeight

      // 若浮窗宽度已大于视口（极小屏），先 clamp width 到 viewport - 2*margin
      let nextWidth = geom.width
      const viewportBudget = vw - 2 * DOCK_MARGIN
      if (nextWidth > viewportBudget && viewportBudget >= MIN_WIDTH) {
        nextWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.floor(viewportBudget)))
      }
      const nextHeight = deriveHeightFromWidth(nextWidth)
      const widthChanged = nextWidth !== geom.width

      // UI Contract §2.3：无论是否越界，只要 corner 有值，始终按 (corner, margin) 重算 left/top
      // 极小屏场景（越界）额外用 nearestCorner 重新归位
      let nextGeom: MiniGeometryV1 = { ...geom, width: nextWidth, height: nextHeight }
      const testPos = computeDockPosition(nextGeom, vw, vh)
      const outOfBounds = testPos.left < 0 || testPos.top < 0
        || testPos.left + nextWidth > vw || testPos.top + nextHeight > vh

      if (outOfBounds) {
        const rect = container.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        const corner = nearestCorner(centerX, centerY, vw, vh)
        nextGeom = { ...nextGeom, corner }
      }

      const { left, top } = computeDockPosition(nextGeom, vw, vh)
      const transitionParts = [
        `left ${SNAP_DURATION_MS}ms ${SNAP_EASING}`,
        `top ${SNAP_DURATION_MS}ms ${SNAP_EASING}`,
      ]
      if (widthChanged) {
        transitionParts.push(
          `width ${SNAP_DURATION_MS}ms ${SNAP_EASING}`,
          `height ${SNAP_DURATION_MS}ms ${SNAP_EASING}`,
        )
      }
      container.style.transition = transitionParts.join(', ')
      container.style.left = `${left}px`
      container.style.top = `${top}px`
      if (widthChanged) {
        container.style.width = `${nextWidth}px`
        container.style.height = `${nextHeight}px`
      }
      // corner 变更（outOfBounds 重归位）或 width 变更均需持久化
      const cornerChanged = nextGeom.corner !== geom.corner
      if (widthChanged || cornerChanged) {
        commitGeometry(nextGeom)
      }
    })
  }

  window.addEventListener('resize', onResize)

  return () => {
    if (rafId !== null) cancelAnimationFrame(rafId)
    window.removeEventListener('resize', onResize)
  }
}
