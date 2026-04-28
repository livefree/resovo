/**
 * toast-viewport.tsx — packages/admin-ui Toast 渲染视口（订阅 toast-store + 自动 dismiss timer 调度）
 *
 * 真源（按优先级）：
 *   - ADR-103a §4.1.7 ToastViewport 公开 API + 行为契约
 *   - ADR-103a §4.3 z-index 4 级（Toast 1300 = `var(--z-shell-toast)`）
 *   - ADR-103a §4.4-2 Edge Runtime 兼容（顶层零 window/document/timer 副作用）
 *   - ADR-103a §4.4-3 零硬编码颜色（admin-layout + semantic + brands token only）
 *
 * 设计要点：
 *   - 订阅 store：useSyncExternalStore 读取 queue（SSR 安全：服务端 snapshot 返 []）
 *   - timer 调度：每条 toast 在 mount 时启动 setTimeout(dismiss, effectiveDuration)；
 *     effectiveDuration === 0 表示永驻不自动消失（level='danger' 默认）
 *   - position：默认 'bottom-right'（ADR-103a §4.1.7 "默认右下；4 角可切换"）
 *   - maxQueue：默认 5（ADR-103a §4.1.7）；溢出 FIFO 由 store push 时根据本组件传入的值裁剪
 *   - level → state token 映射：info → state-info / success → state-success / warn → state-warning / danger → state-error
 *
 * 不做：
 *   - 不 SSR pre-render queue（toast 仅 client mount 后激活）
 *   - 不依赖 i18n / brand
 *   - 不实现入场/退场 CSS 动画（M-SN-2 后续可在 v2 内迭代；ADR 未强制）
 */
import { useEffect, useSyncExternalStore } from 'react'
import { toastStore, type ToastItem, type ToastLevel } from './toast-store'

export type ToastPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export interface ToastViewportProps {
  readonly position?: ToastPosition
  readonly maxQueue?: number
}

export function ToastViewport({ position = 'bottom-right', maxQueue = 5 }: ToastViewportProps) {
  const queue = useSyncExternalStore(subscribeToStore, getQueueSnapshot, getQueueSnapshotSSR)

  // 同步 props.maxQueue 到 store（多 ViewPort 实例时由最后一次 mount 决定全局值）
  useEffect(() => {
    toastStore.getState().setMaxQueue(maxQueue)
  }, [maxQueue])

  return (
    <div
      role="region"
      aria-label="通知"
      aria-live="polite"
      data-toast-viewport={position}
      data-max-queue={maxQueue}
      style={{
        position: 'fixed',
        zIndex: 'var(--z-shell-toast)' as unknown as number,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        padding: 'var(--space-4)',
        pointerEvents: 'none',
        ...positionStyles(position),
      }}
    >
      {queue.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  )
}

function ToastCard({ item }: { readonly item: ToastItem }) {
  const slot = STATE_SLOT_BY_LEVEL[item.level]
  useEffect(() => {
    if (item.effectiveDuration <= 0) return
    const timer = setTimeout(() => {
      toastStore.getState().dismiss(item.id)
    }, item.effectiveDuration)
    return () => clearTimeout(timer)
  }, [item.id, item.effectiveDuration])

  return (
    <div
      role="status"
      data-toast-id={item.id}
      data-toast-level={item.level}
      style={{
        pointerEvents: 'auto',
        minWidth: '280px',
        maxWidth: '420px',
        padding: 'var(--space-3) var(--space-4)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        background: `var(--state-${slot}-bg)`,
        color: `var(--state-${slot}-fg)`,
        border: `1px solid var(--state-${slot}-border)`,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{item.title}</div>
          {item.description && (
            <div style={{ marginTop: 'var(--space-1)', fontSize: 'var(--font-size-sm)', opacity: 0.85 }}>
              {item.description}
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label="关闭通知"
          onClick={() => toastStore.getState().dismiss(item.id)}
          style={{
            flexShrink: 0,
            background: 'transparent',
            border: 0,
            color: 'inherit',
            cursor: 'pointer',
            padding: 'var(--space-1)',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            item.action?.onClick()
            toastStore.getState().dismiss(item.id)
          }}
          style={{
            alignSelf: 'flex-end',
            background: 'transparent',
            border: `1px solid var(--state-${slot}-border)`,
            color: 'inherit',
            padding: 'var(--space-1) var(--space-3)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--font-size-sm)',
            cursor: 'pointer',
          }}
        >
          {item.action.label}
        </button>
      )}
    </div>
  )
}

/** zustand store 订阅适配（useSyncExternalStore 三参数） */
function subscribeToStore(callback: () => void): () => void {
  return toastStore.subscribe(callback)
}

function getQueueSnapshot(): readonly ToastItem[] {
  return toastStore.getState().queue
}

/** SSR snapshot：服务端渲染时返 empty 引用稳定值（避免水合不匹配） */
const SSR_EMPTY_QUEUE: readonly ToastItem[] = []
function getQueueSnapshotSSR(): readonly ToastItem[] {
  return SSR_EMPTY_QUEUE
}

/** ToastLevel → state token slot 映射（ADR-103a §4.1.7 + semantic.state token 命名）
 *  ToastLevel union: 'info' | 'success' | 'warn' | 'danger'
 *  state token slots: 'info' | 'success' | 'warning' | 'error'
 *  本映射仅在 ToastViewport / ToastCard 渲染层使用，不污染 toast-store API */
const STATE_SLOT_BY_LEVEL: Record<ToastLevel, 'info' | 'success' | 'warning' | 'error'> = {
  info: 'info',
  success: 'success',
  warn: 'warning',
  danger: 'error',
}

function positionStyles(position: ToastPosition): React.CSSProperties {
  switch (position) {
    case 'top-left':
      return { top: 0, left: 0 }
    case 'top-right':
      return { top: 0, right: 0 }
    case 'bottom-left':
      return { bottom: 0, left: 0 }
    case 'bottom-right':
      return { bottom: 0, right: 0 }
  }
}
