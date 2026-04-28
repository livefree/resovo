/**
 * toast-store.ts — packages/admin-ui Toast 队列单例 store（zustand）
 *
 * 真源（按优先级）：
 *   - ADR-103a §4.1.7 ToastViewport + useToast 公开 API 契约
 *   - ADR-103a §4.4-1 Provider 不下沉硬约束（zustand 单例非 Context Provider）
 *   - ADR-103a §4.4-2 Edge Runtime 兼容（模块顶层零副作用）
 *
 * 设计要点：
 *   - 单例 store：模块顶层 createStore 不触发任何副作用（SSR 安全）
 *   - 状态形态：readonly queue + nextId 自增计数；外部禁止直接修改
 *   - actions：push（生成 toastId 入队 + 计算 effective duration） / dismiss / dismissAll
 *   - 自动消失：push 内部不调度 timer（避免 SSR 残留）；timer 调度交由 ToastViewport useEffect 副作用处理
 *   - level='danger' 不自动消失语义：durationMs undefined + level='danger' → effectiveDuration = 0（永驻）
 *   - 队列溢出 FIFO：push 后 queue 长度 > maxQueue 时，自动 shift 最早项；maxQueue 由 ToastViewport.props 注入到 push 调用时
 *
 * 不变约束：
 *   - 模块顶层零 fetch / Cookie / localStorage / window / document / navigator 访问
 *   - 多个 ToastViewport 实例共享同一 store（应用全局单一队列）
 *   - 每条 toast 不可变（push 后内部状态不可外部修改；只能 dismiss）
 *
 * 跨域消费：本 store 仅被 packages/admin-ui Shell 内部消费（use-toast.ts + toast-viewport.tsx）；
 * server-next 应用层通过 useToast() hook 接入，禁止直接 import 本文件。
 */
import { createStore } from 'zustand/vanilla'

export type ToastLevel = 'info' | 'success' | 'warn' | 'danger'

export interface ToastInput {
  readonly title: string
  readonly description?: string
  readonly level: ToastLevel
  /** 自动消失毫秒数；undefined 时按 level 决定（danger → 不自动消失；其余 4000ms） */
  readonly durationMs?: number
  /** 可选操作按钮（最多 1 个） */
  readonly action?: { readonly label: string; readonly onClick: () => void }
}

export interface ToastItem extends ToastInput {
  readonly id: string
  /** 入队时刻 unix ms（仅供 ToastViewport 排序 + 调度 timer 起点参考；不强制等于 createdAt） */
  readonly enqueuedAt: number
  /** 实际生效的自动消失毫秒数；0 表示永驻不自动消失 */
  readonly effectiveDuration: number
}

/** 默认 duration 与 level 映射规则（ADR-103a §4.1.7）：
 *  - durationMs 显式给定（含 0）→ 直接采用
 *  - durationMs undefined + level='danger' → 0（永驻不自动消失）
 *  - durationMs undefined + 其他 level → DEFAULT_DURATION_MS */
export const DEFAULT_DURATION_MS = 4000

export const DEFAULT_MAX_QUEUE = 5

export interface ToastStoreState {
  readonly queue: readonly ToastItem[]
  /** 自增 id 序号；与 enqueuedAt 配合保证 toastId 唯一 */
  readonly nextSeq: number
  /** 队列上限（FIFO 溢出阈值）；由 ToastViewport.useEffect 在 props 变更时同步 */
  readonly maxQueue: number
}

export interface ToastStoreActions {
  /** 入队一条 toast；返回 toastId（外部用于 dismiss / 单测断言）
   *  按 store.maxQueue 触发 FIFO（最早入队条目被剔除） */
  readonly push: (input: ToastInput) => string
  readonly dismiss: (id: string) => void
  readonly dismissAll: () => void
  /** ToastViewport.props.maxQueue 同步入口；变更后下次 push 即按新阈值裁剪
   *  允许多个 ToastViewport 实例共享同一 store 时由最后一次 setMaxQueue 决定 */
  readonly setMaxQueue: (maxQueue: number) => void
}

export type ToastStoreApi = ReturnType<typeof createToastStore>

export function createToastStore() {
  return createStore<ToastStoreState & ToastStoreActions>()((set, get) => ({
    queue: [],
    nextSeq: 0,
    maxQueue: DEFAULT_MAX_QUEUE,
    push: (input) => {
      const { nextSeq, maxQueue } = get()
      const enqueuedAt = Date.now()
      const id = `toast-${nextSeq}-${enqueuedAt}`
      const effectiveDuration = resolveEffectiveDuration(input.durationMs, input.level)
      const item: ToastItem = { ...input, id, enqueuedAt, effectiveDuration }
      set((state) => {
        const merged = [...state.queue, item]
        const trimmed = merged.length > maxQueue ? merged.slice(merged.length - maxQueue) : merged
        return { queue: trimmed, nextSeq: state.nextSeq + 1 }
      })
      return id
    },
    dismiss: (id) => {
      set((state) => ({ queue: state.queue.filter((t) => t.id !== id) }))
    },
    dismissAll: () => {
      set({ queue: [] })
    },
    setMaxQueue: (maxQueue) => {
      set((state) => {
        const trimmed = state.queue.length > maxQueue ? state.queue.slice(state.queue.length - maxQueue) : state.queue
        return { maxQueue, queue: trimmed }
      })
    },
  }))
}

function resolveEffectiveDuration(durationMs: number | undefined, level: ToastLevel): number {
  if (durationMs !== undefined) return durationMs
  if (level === 'danger') return 0
  return DEFAULT_DURATION_MS
}

/** 应用全局共享的单例 store（ADR-103a §4.4-1 Provider 不下沉的 zustand 实现）
 *  多个 ToastViewport 实例订阅同一 store，确保应用全局单一队列。 */
export const toastStore: ToastStoreApi = createToastStore()
