'use client'

/**
 * react-node-utils.ts — DataTable 共享 ReactNode 处理工具
 * （CHG-DESIGN-02 Step 4 fix#: 抽出 Step 3 fix#1-6 的成果，给 toolbar slots 复用）
 *
 * 提供：
 *   - materializeNode：把 single-use iterable（generator / iterator / Set / 自定义）
 *     转 Array 后可重复迭代；非 iterable 值原样返回。
 *   - isRenderableNode：判定 ReactNode 是否会渲染出可见内容（排除合法但渲染为空的值）。
 *   - useRenderableSlot：React hook，组合 materialize + 检测 + useRef 缓存。
 *     useRef 缓存策略：source nullish 时不动缓存（保留先前物化结果），
 *     避免 close/reopen 等 nullish 间隔后重消耗已耗尽的 generator。
 */
import { useRef, type ReactNode } from 'react'

/**
 * 把 filterContent / 任意 ReactNode slot 物化为可重复渲染的形态：
 *   - Array / 字符串 / ReactElement / 原始值 → 原样返回（不复制）
 *   - 其他 Iterable（Set / generator / 自定义）→ Array.from 物化
 */
export function materializeNode(node: ReactNode): ReactNode {
  if (node === null || node === undefined) return node
  if (typeof node !== 'object') return node
  if (Array.isArray(node)) return node
  const candidate = node as { [Symbol.iterator]?: unknown }
  if (typeof candidate[Symbol.iterator] === 'function') {
    return Array.from(node as Iterable<ReactNode>)
  }
  return node
}

/**
 * ReactNode 是否会渲染出可见内容。
 * 调用前应先 materializeNode，确保 single-use iterable 已转 Array。
 *
 * 处理顺序：
 *   1. nullish / boolean → false
 *   2. 字符串 → 仅非空 renderable
 *   3. number / bigint → true
 *   4. Array → 至少一个元素 renderable（递归）
 *   5. 非 array object（ReactElement / ReactPortal）→ renderable
 *
 * 不覆盖：空 React Fragment <></>（检测脆弱，文档级约束）。
 */
export function isRenderableNode(node: ReactNode): boolean {
  if (node === undefined || node === null) return false
  if (typeof node === 'boolean') return false
  if (typeof node === 'string') return node !== ''
  if (typeof node === 'number' || typeof node === 'bigint') return true
  if (typeof node !== 'object') return true
  if (Array.isArray(node)) return node.some(isRenderableNode)
  return true
}

/**
 * useRenderableSlot — 给 ReactNode slot 提供 materialize + 检测 + 缓存。
 *
 * 使用场景：DataTable 工具栏 search / trailing slot、HeaderMenu filter slot。
 *
 * 缓存策略（fix#6）：
 *   - source nullish（菜单关闭等场景）→ 不动缓存，filterContent=undefined
 *   - source 同上次缓存的 source → 复用 cacheRef.current.result
 *   - source 变化为新的非空值 → 重新物化 + 更新缓存
 *
 * Rules of Hooks：本 hook 内部用 useRef，必须无条件调用（消费方在所有早期 return 之前调）。
 */
export function useRenderableSlot(source: ReactNode): {
  readonly renderable: boolean
  readonly node: ReactNode
} {
  const cacheRef = useRef<{ source: ReactNode; result: ReactNode } | null>(null)
  let node: ReactNode = undefined
  if (source !== undefined && source !== null) {
    if (cacheRef.current?.source !== source) {
      cacheRef.current = { source, result: materializeNode(source) }
    }
    node = cacheRef.current.result
  }
  return { renderable: isRenderableNode(node), node }
}
