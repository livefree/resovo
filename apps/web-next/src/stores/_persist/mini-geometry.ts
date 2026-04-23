/**
 * mini-geometry.ts — HANDOFF-03 Storage 协调协议
 *
 * localStorage 持久化 MiniPlayer 浮窗几何（宽度 + 吸附角）。
 * 与 sessionStorage['resovo:player-host:v1']（续播 hostMode）职责严格分离：
 *   - sessionStorage 权威决定 hostMode（mini/pip/full/closed）
 *   - localStorage 只决定位置（几何），不决定显隐
 *   - hostMode=closed/full 时忽略 localStorage（Hydrate 时序规则）
 *
 * 纯函数 + 容错解析：损坏值、类型不匹配、corner 枚举越界均返回 null，由消费方 fallback 到默认值。
 * 不用 zustand persist middleware，避免污染 hostMode 序列化。
 */

export type MiniCorner = 'tl' | 'tr' | 'bl' | 'br'

export interface MiniGeometryV1 {
  readonly v: 1
  readonly width: number      // px，240–480
  readonly height: number     // px，= width × 9/16（16:9 保持）
  readonly corner: MiniCorner // 吸附到四角之一
}

const STORAGE_KEY = 'resovo:player-mini-geometry:v1'
const VALID_CORNERS = new Set<string>(['tl', 'tr', 'bl', 'br'])

export const MINI_GEOMETRY_CONSTRAINTS = {
  MIN_WIDTH: 240,
  MAX_WIDTH: 480,
  ASPECT_RATIO: 16 / 9,
  DOCK_MARGIN: 16,          // px，距视口边缘
  SNAP_DURATION_MS: 260,    // spring 吸附动画时长
  SNAP_EASING: 'cubic-bezier(0.34, 1.56, 0.64, 1)' as const,
  DEFAULT_CORNER: 'br' as const satisfies MiniCorner,
} as const

const { MIN_WIDTH, MAX_WIDTH, ASPECT_RATIO, DEFAULT_CORNER } = MINI_GEOMETRY_CONSTRAINTS

export const MINI_GEOMETRY_DEFAULTS: MiniGeometryV1 = Object.freeze({
  v: 1,
  width: 320,
  height: Math.round(320 / ASPECT_RATIO),
  corner: DEFAULT_CORNER,
})

/**
 * 读 localStorage 几何；任何错误返回 null，由消费方 fallback 到 MINI_GEOMETRY_DEFAULTS。
 * SSR 安全（typeof window === 'undefined' 返回 null）。
 */
export function readMiniGeometry(): MiniGeometryV1 | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isValidGeometry(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * 写 localStorage 几何；仅在 drag-end / resize-end / close-mini 三事件点调用，
 * 不在拖拽过程中高频写。quotaExceeded 等异常静默忽略。
 */
export function writeMiniGeometry(geom: MiniGeometryV1): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(geom))
  } catch {
    // localStorage unavailable / quota — silently ignore
  }
}

/** 清除 localStorage 几何（测试用途 / 未来"重置设置"入口）。 */
export function clearMiniGeometry(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/**
 * 校验从 localStorage 读出的未知值是否为合法 MiniGeometryV1。
 *   - v: 必须为 1（未来升级 v2 时独立分支）
 *   - width: 必须在 [MIN_WIDTH, MAX_WIDTH] 内
 *   - height: 必须为正数（不强制 16:9 精确比例，留浮点宽容）
 *   - corner: 必须在 VALID_CORNERS 枚举内
 */
function isValidGeometry(x: unknown): x is MiniGeometryV1 {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  if (o.v !== 1) return false
  if (typeof o.width !== 'number' || !Number.isFinite(o.width)) return false
  if (o.width < MIN_WIDTH || o.width > MAX_WIDTH) return false
  if (typeof o.height !== 'number' || !Number.isFinite(o.height) || o.height <= 0) return false
  if (typeof o.corner !== 'string' || !VALID_CORNERS.has(o.corner)) return false
  return true
}

/**
 * 根据 width 计算 16:9 对应 height；用于拖拽 resize 时同步更新两轴。
 */
export function deriveHeightFromWidth(width: number): number {
  return Math.round(width / ASPECT_RATIO)
}

/**
 * 将任意 width 夹紧到 [MIN_WIDTH, MAX_WIDTH]。
 */
export function clampWidth(width: number): number {
  if (!Number.isFinite(width)) return MINI_GEOMETRY_DEFAULTS.width
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(width)))
}

/**
 * 根据 viewport + 几何 + 吸附角计算浮窗左上角的 fixed 定位 (left, top) px。
 * 用于 render 阶段把 corner + width/height → 具体 CSS transform/left/top。
 */
export function computeDockPosition(
  geom: MiniGeometryV1,
  viewportWidth: number,
  viewportHeight: number,
  margin: number = MINI_GEOMETRY_CONSTRAINTS.DOCK_MARGIN,
): { left: number; top: number } {
  const { width, height, corner } = geom
  switch (corner) {
    case 'tl': return { left: margin, top: margin }
    case 'tr': return { left: viewportWidth - width - margin, top: margin }
    case 'bl': return { left: margin, top: viewportHeight - height - margin }
    case 'br': return { left: viewportWidth - width - margin, top: viewportHeight - height - margin }
  }
}

/**
 * 根据浮窗中心点找最近的四角之一；用于 drag-end 吸附与 window.resize 越界 re-snap。
 */
export function nearestCorner(
  centerX: number,
  centerY: number,
  viewportWidth: number,
  viewportHeight: number,
): MiniCorner {
  const isLeft = centerX < viewportWidth / 2
  const isTop = centerY < viewportHeight / 2
  if (isTop && isLeft) return 'tl'
  if (isTop) return 'tr'
  if (isLeft) return 'bl'
  return 'br'
}
