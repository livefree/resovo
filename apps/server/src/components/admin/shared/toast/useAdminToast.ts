/**
 * useAdminToast.ts — 后台全局 Toast 状态管理
 * UX-01: 统一操作反馈，替换 alert()
 *
 * 使用方式：
 *   import { notify } from '@/components/admin/shared/toast/useAdminToast'
 *   notify.success('操作成功')
 *   notify.error('操作失败', { dedupeKey: 'save-error' })
 */

import { create } from 'zustand'

// ── 类型定义 ──────────────────────────────────────────────────────

export type ToastType = 'success' | 'info' | 'warn' | 'error'

export interface ToastItem {
  id: string
  type: ToastType
  message: string
  dedupeKey?: string
  duration: number     // ms，0 = 不自动关闭
  persistent?: boolean // 队列最前，不自动关闭（系统级告警）
}

export interface NotifyOptions {
  dedupeKey?: string
  duration?: number
  persistent?: boolean
}

// ── 默认时长（毫秒）────────────────────────────────────────────────

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 3000,
  info:    3000,
  warn:    6000,
  error:   6000,
}

const MAX_VISIBLE = 3

// ── 状态 ──────────────────────────────────────────────────────────

interface AdminToastState {
  visible: ToastItem[]   // 当前展示（最多 MAX_VISIBLE 条）
  queue: ToastItem[]     // 排队等待
  _add(item: ToastItem): void
  dismiss(id: string): void
}

let _idCounter = 0
function genId() {
  return `toast-${++_idCounter}-${Date.now()}`
}

export const useAdminToastStore = create<AdminToastState>((set, get) => ({
  visible: [],
  queue: [],

  _add(item: ToastItem) {
    const state = get()

    // 去重：visible 和 queue 中若已存在相同 dedupeKey，跳过
    if (item.dedupeKey) {
      const isDupe =
        state.visible.some((t) => t.dedupeKey === item.dedupeKey) ||
        state.queue.some((t) => t.dedupeKey === item.dedupeKey)
      if (isDupe) return
    }

    if (state.visible.length < MAX_VISIBLE) {
      // 持久告警插到最前，普通告警追加到末尾
      const nextVisible = item.persistent
        ? [item, ...state.visible]
        : [...state.visible, item]
      set({ visible: nextVisible })
    } else {
      set({ queue: [...state.queue, item] })
    }
  },

  dismiss(id: string) {
    const state = get()
    const nextVisible = state.visible.filter((t) => t.id !== id)
    // 从队列中补充
    if (state.queue.length > 0 && nextVisible.length < MAX_VISIBLE) {
      const [next, ...rest] = state.queue
      set({ visible: [...nextVisible, next], queue: rest })
    } else {
      set({ visible: nextVisible })
    }
  },


}))

// ── 公共 notify API ───────────────────────────────────────────────

function addToast(type: ToastType, message: string, options: NotifyOptions = {}) {
  const duration = options.duration ?? DEFAULT_DURATION[type]
  const item: ToastItem = {
    id: genId(),
    type,
    message,
    dedupeKey: options.dedupeKey,
    duration: options.persistent ? 0 : duration,
    persistent: options.persistent,
  }
  useAdminToastStore.getState()._add(item)
}

export const notify = {
  success: (message: string, options?: NotifyOptions) => addToast('success', message, options),
  info:    (message: string, options?: NotifyOptions) => addToast('info', message, options),
  warn:    (message: string, options?: NotifyOptions) => addToast('warn', message, options),
  error:   (message: string, options?: NotifyOptions) => addToast('error', message, options),
}
