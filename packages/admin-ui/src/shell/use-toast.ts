/**
 * use-toast.ts — useToast hook，包装 toast-store 单例的 push / dismiss / dismissAll
 *
 * 真源（按优先级）：
 *   - ADR-103a §4.1.7 useToast 公开 API（`{ push, dismiss, dismissAll }`）
 *
 * 设计要点：
 *   - 不依赖 React Context（store 是模块级单例；ADR-103a §4.4-1 Provider 不下沉）
 *   - hook 内部不订阅 store state（消费方仅触发 actions；queue 状态订阅由 ToastViewport 内部完成）
 *   - 返回稳定引用：actions 是 store API 直接透传，引用稳定（zustand store 实例不变）
 *   - SSR 安全：hook 在服务端调用返回的 actions 仍可执行（push 调用 store.getState().push 同样安全；
 *     queue 副本仅在客户端通过 ToastViewport useSyncExternalStore 订阅渲染）
 *
 * 跨域消费：
 *   - server-next 应用层：`import { useToast } from '@resovo/admin-ui'`，调用 `useToast().push({...})`
 *   - 不允许直接 import toast-store.ts（store 是 packages/admin-ui 内部实现细节）
 */
import { toastStore, type ToastInput } from './toast-store'

export interface UseToastReturn {
  readonly push: (input: ToastInput) => string
  readonly dismiss: (id: string) => void
  readonly dismissAll: () => void
}

/** 全局 Toast API hook（ADR-103a §4.1.7）
 *  返回稳定引用的 { push, dismiss, dismissAll }；不订阅 queue state（避免无谓 re-render）。
 *  ToastViewport 组件内部用 useSyncExternalStore 单独订阅 queue 渲染。 */
export function useToast(): UseToastReturn {
  return USE_TOAST_RETURN
}

/** 模块级常量返回值，确保 hook 调用次次返回同一引用（避免依赖 useMemo 增加开销） */
const USE_TOAST_RETURN: UseToastReturn = {
  push: (input) => toastStore.getState().push(input),
  dismiss: (id) => toastStore.getState().dismiss(id),
  dismissAll: () => toastStore.getState().dismissAll(),
}
