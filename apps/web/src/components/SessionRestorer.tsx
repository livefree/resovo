/**
 * SessionRestorer.tsx — 页面刷新后静默恢复登录会话
 * CHG-37: 在 root layout 挂载，mount 时触发一次 tryRestoreSession
 */

'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'

export function SessionRestorer() {
  const tryRestoreSession = useAuthStore((s) => s.tryRestoreSession)

  useEffect(() => {
    void tryRestoreSession()
  }, [tryRestoreSession])

  return null
}
