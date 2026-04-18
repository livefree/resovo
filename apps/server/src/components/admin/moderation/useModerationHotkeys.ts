/**
 * useModerationHotkeys.ts — 审核台快捷键 Hook（CHG-224）
 * A = 通过（approve）
 * R = 拒绝（reject）
 * ArrowLeft / ArrowRight = 切换上一条 / 下一条
 * 仅在未聚焦文本输入框时生效
 */

import { useEffect } from 'react'

interface UseModerationHotkeysOptions {
  /** 是否启用快捷键（可通过 isDetailActive 等条件控制） */
  enabled: boolean
  onApprove: () => void
  onReject: () => void
  onPrev: () => void
  onNext: () => void
}

function isInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable
}

export function useModerationHotkeys({
  enabled,
  onApprove,
  onReject,
  onPrev,
  onNext,
}: UseModerationHotkeysOptions): void {
  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(e: KeyboardEvent): void {
      if (isInputFocused()) return
      // Ignore if any modifier key is held (except Shift)
      if (e.ctrlKey || e.metaKey || e.altKey) return

      switch (e.key) {
        case 'a':
        case 'A':
          e.preventDefault()
          onApprove()
          break
        case 'r':
        case 'R':
          e.preventDefault()
          onReject()
          break
        case 'ArrowLeft':
          e.preventDefault()
          onPrev()
          break
        case 'ArrowRight':
          e.preventDefault()
          onNext()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => { window.removeEventListener('keydown', handleKeyDown) }
  }, [enabled, onApprove, onReject, onPrev, onNext])
}
