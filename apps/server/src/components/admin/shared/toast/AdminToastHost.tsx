/**
 * AdminToastHost.tsx — 后台全局 Toast 宿主组件
 * UX-01: 右下角固定，不占文档流；最多展示 3 条；自动关闭
 *
 * 挂载位置：src/app/[locale]/admin/layout.tsx
 */

'use client'

import { useEffect } from 'react'
import { useAdminToastStore } from './useAdminToast'
import type { ToastItem, ToastType } from './useAdminToast'

// ── 配色映射 ──────────────────────────────────────────────────────

const TYPE_STYLES: Record<ToastType, { icon: string; bg: string; border: string; text: string }> = {
  success: {
    icon: '✓',
    bg: 'var(--status-success-bg, #052e16)',
    border: 'var(--status-success, #22c55e)',
    text: 'var(--status-success, #22c55e)',
  },
  info: {
    icon: 'ℹ',
    bg: 'var(--card)',
    border: 'var(--border)',
    text: 'var(--foreground)',
  },
  warn: {
    icon: '⚠',
    bg: 'var(--status-warn-bg, #431407)',
    border: 'var(--status-warn, #f97316)',
    text: 'var(--status-warn, #f97316)',
  },
  error: {
    icon: '✕',
    bg: 'var(--status-danger-bg, #450a0a)',
    border: 'var(--status-danger, #ef4444)',
    text: 'var(--status-danger, #ef4444)',
  },
}

// ── 单条 Toast ────────────────────────────────────────────────────

function ToastCard({ item }: { item: ToastItem }) {
  const dismiss = useAdminToastStore((s) => s.dismiss)
  const styles = TYPE_STYLES[item.type]

  useEffect(() => {
    if (!item.duration) return
    const timer = setTimeout(() => dismiss(item.id), item.duration)
    return () => clearTimeout(timer)
  }, [item.id, item.duration, dismiss])

  return (
    <div
      role="alert"
      data-testid={`admin-toast-${item.type}`}
      style={{
        background: styles.bg,
        borderColor: styles.border,
        color: 'var(--foreground)',
      }}
      className="flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg text-sm min-w-[260px] max-w-[380px] pointer-events-auto"
    >
      <span
        className="shrink-0 font-bold text-base leading-none mt-0.5"
        style={{ color: styles.text }}
        aria-hidden="true"
      >
        {styles.icon}
      </span>
      <span className="flex-1 leading-snug break-words">{item.message}</span>
      <button
        type="button"
        onClick={() => dismiss(item.id)}
        aria-label="关闭提示"
        className="shrink-0 opacity-50 hover:opacity-100 transition-opacity leading-none text-base"
      >
        ×
      </button>
    </div>
  )
}

// ── 宿主组件 ──────────────────────────────────────────────────────

export function AdminToastHost() {
  const visible = useAdminToastStore((s) => s.visible)

  if (visible.length === 0) return null

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      data-testid="admin-toast-host"
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none"
    >
      {visible.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  )
}
