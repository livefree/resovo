/**
 * Modal.tsx — 受控模态框（Admin 基础组件库）
 * CHG-24: 支持 ESC 关闭、遮罩点击关闭、三种尺寸
 */

'use client'

import { useEffect, useCallback, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

// ── 类型 ──────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_CLASS = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const

// ── Component ─────────────────────────────────────────────────────

export function Modal({ open, onClose, title, children, size = 'md', className }: ModalProps) {
  // ESC 关闭
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, handleKeyDown])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      data-testid="modal-overlay"
      onClick={onClose}  // 遮罩点击关闭
    >
      {/* 遮罩层 */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.6)' }}
        aria-hidden="true"
      />

      {/* 内容区 */}
      <div
        className={cn(
          'relative w-full rounded-xl shadow-2xl',
          SIZE_CLASS[size],
          className
        )}
        style={{ background: 'var(--bg4, var(--bg2))' }}
        data-testid="modal-content"
        onClick={(e) => e.stopPropagation()}  // 阻止内容区点击冒泡关闭
      >
        {/* 标题栏 */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h2
            className="text-base font-semibold"
            style={{ color: 'var(--text)' }}
            data-testid="modal-title"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--bg3)] transition-colors"
            style={{ color: 'var(--muted)' }}
            aria-label="关闭"
            data-testid="modal-close-btn"
          >
            ✕
          </button>
        </div>

        {/* 内容 */}
        <div className="px-6 py-4" data-testid="modal-body">
          {children}
        </div>
      </div>
    </div>
  )
}
