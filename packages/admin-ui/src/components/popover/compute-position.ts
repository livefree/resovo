/**
 * compute-position.ts — Popover 手写 placement 算法
 * 真源：ADR-115 §2.2（admin-ui Popover 通用原语 API 契约 / placement 策略）
 *
 * 决策：不引入 floating-ui（不在 ADR-100 依赖白名单三类任一），手写最小 flip + shift。
 *
 * 算法范围（v1 minimum viable subset，ADR-115 §3.1 第 4 条）：
 *   - 6 placement 方位：top / bottom / left / right / bottom-start / bottom-end
 *   - flip：首选 placement 出 viewport 时翻转到对侧
 *   - shift：沿轴向夹紧到 viewport 内（避免溢出）
 *   - 不实现：size adjustment / virtual element / middleware / nested popover / RTL
 *
 * v1 不实施（type 保留 12 placement 向前兼容，但 -start / -end 仅 bottom 两个方位有效；
 * 其他 -start / -end 变体在 v1 走 fallback 到对应基础方位）。
 *
 * 输入：trigger 元素 getBoundingClientRect / content 期望尺寸 / viewport 尺寸 / 首选 placement / offset
 * 输出：top + left 像素值 + 实际生效 placement（若发生 flip）
 */

export type PopoverPlacement =
  | 'top' | 'top-start' | 'top-end'
  | 'bottom' | 'bottom-start' | 'bottom-end'
  | 'left' | 'left-start' | 'left-end'
  | 'right' | 'right-start' | 'right-end'

/** v1 实施的 6 placement（ADR-115 §3.1 第 4 条 minimum viable subset）*/
export const V1_PLACEMENTS: readonly PopoverPlacement[] = [
  'top',
  'bottom',
  'left',
  'right',
  'bottom-start',
  'bottom-end',
] as const

export interface Rect {
  readonly top: number
  readonly left: number
  readonly width: number
  readonly height: number
}

export interface Viewport {
  readonly width: number
  readonly height: number
}

export interface ComputePositionInput {
  readonly trigger: Rect
  readonly content: { readonly width: number; readonly height: number }
  readonly viewport: Viewport
  readonly placement: PopoverPlacement
  readonly offset: number
}

export interface ComputedPosition {
  readonly top: number
  readonly left: number
  /** 经 flip 后实际生效的 placement（无 flip 时与输入相同）*/
  readonly placement: PopoverPlacement
}

const EDGE_PADDING = 8

/**
 * 主入口：先按首选 placement 计算；若不 fit viewport 则尝试 flip；最后 shift 夹紧。
 */
export function computePosition(input: ComputePositionInput): ComputedPosition {
  const primary = computeAt(input.trigger, input.content, input.placement, input.offset)
  if (fitsInViewport(primary, input.content, input.viewport)) {
    return { ...primary, placement: input.placement }
  }

  const flipped = flipPlacement(input.placement)
  const flippedPos = computeAt(input.trigger, input.content, flipped, input.offset)
  if (fitsInViewport(flippedPos, input.content, input.viewport)) {
    return { ...flippedPos, placement: flipped }
  }

  const shifted = shiftIntoViewport(primary, input.content, input.viewport)
  return { ...shifted, placement: input.placement }
}

/**
 * 在指定 placement 计算 top/left（不做 flip / shift）。
 *
 * 坐标系：viewport 左上为原点；返回 fixed-position 像素值（搭配 position:fixed 使用）。
 */
function computeAt(
  trigger: Rect,
  content: ComputePositionInput['content'],
  placement: PopoverPlacement,
  offset: number,
): { top: number; left: number } {
  // 主轴位置（top/bottom/left/right） — 决定 popover 在 trigger 哪一侧
  let top = 0
  let left = 0

  if (placement.startsWith('top')) {
    top = trigger.top - content.height - offset
  } else if (placement.startsWith('bottom')) {
    top = trigger.top + trigger.height + offset
  } else if (placement.startsWith('left')) {
    left = trigger.left - content.width - offset
  } else if (placement.startsWith('right')) {
    left = trigger.left + trigger.width + offset
  }

  // 交叉轴位置（基于 -start / -end 修饰符）
  if (placement === 'top' || placement === 'bottom') {
    // 居中对齐 trigger 中心
    left = trigger.left + (trigger.width - content.width) / 2
  } else if (placement === 'top-start' || placement === 'bottom-start') {
    // 与 trigger 左边对齐
    left = trigger.left
  } else if (placement === 'top-end' || placement === 'bottom-end') {
    // 与 trigger 右边对齐
    left = trigger.left + trigger.width - content.width
  } else if (placement === 'left' || placement === 'right') {
    // 居中对齐 trigger 垂直中心
    top = trigger.top + (trigger.height - content.height) / 2
  } else if (placement === 'left-start' || placement === 'right-start') {
    top = trigger.top
  } else if (placement === 'left-end' || placement === 'right-end') {
    top = trigger.top + trigger.height - content.height
  }

  return { top, left }
}

function fitsInViewport(
  pos: { top: number; left: number },
  content: ComputePositionInput['content'],
  viewport: Viewport,
): boolean {
  return (
    pos.top >= EDGE_PADDING &&
    pos.left >= EDGE_PADDING &&
    pos.top + content.height <= viewport.height - EDGE_PADDING &&
    pos.left + content.width <= viewport.width - EDGE_PADDING
  )
}

/**
 * placement 翻转规则：仅翻转主轴，保留交叉轴修饰符。
 *   top ↔ bottom；left ↔ right；
 *   top-start ↔ bottom-start；bottom-end ↔ top-end；以此类推。
 */
export function flipPlacement(placement: PopoverPlacement): PopoverPlacement {
  if (placement.startsWith('top')) return placement.replace('top', 'bottom') as PopoverPlacement
  if (placement.startsWith('bottom')) return placement.replace('bottom', 'top') as PopoverPlacement
  if (placement.startsWith('left')) return placement.replace('left', 'right') as PopoverPlacement
  if (placement.startsWith('right')) return placement.replace('right', 'left') as PopoverPlacement
  return placement
}

/**
 * 沿两轴夹紧到 viewport 内（保留 EDGE_PADDING）。
 */
function shiftIntoViewport(
  pos: { top: number; left: number },
  content: ComputePositionInput['content'],
  viewport: Viewport,
): { top: number; left: number } {
  const maxTop = viewport.height - content.height - EDGE_PADDING
  const maxLeft = viewport.width - content.width - EDGE_PADDING
  return {
    top: Math.max(EDGE_PADDING, Math.min(pos.top, maxTop)),
    left: Math.max(EDGE_PADDING, Math.min(pos.left, maxLeft)),
  }
}
