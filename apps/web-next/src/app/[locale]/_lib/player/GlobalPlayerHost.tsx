'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePlayerStore } from '@/stores/playerStore'
import { GlobalPlayerFullFrame } from './GlobalPlayerFullFrame'
import { MiniPlayer } from './MiniPlayer'

const PORTAL_ID = 'global-player-host-portal'

/**
 * PiP 态：真实画面由浏览器 PiP 窗口控制，Host 侧只保留不可见的 slot。
 * 浏览器 leavepictureinpicture 事件触发后由 VideoPlayer 调用 setHostMode('mini')。
 * REG-M3-04 接入真实 video 元素后，PiP 入口 button disabled 检测由 pip.ts isPipSupported() 驱动。
 */
function PipSlot() {
  return (
    <div
      data-testid="global-player-pip-slot"
      style={{ display: 'none' }}
      aria-hidden
    />
  )
}

export default function GlobalPlayerHost() {
  const hostMode = usePlayerStore((s) => s.hostMode)
  const isHydrated = usePlayerStore((s) => s.isHydrated)
  const hydrateFromSession = usePlayerStore((s) => s.hydrateFromSession)
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalEl(document.getElementById(PORTAL_ID))
    if (!isHydrated) hydrateFromSession()
  }, [isHydrated, hydrateFromSession])

  if (!portalEl || hostMode === 'closed') return null

  return createPortal(
    <div data-testid="global-player-host-root" data-host-mode={hostMode}>
      {hostMode === 'full' && <GlobalPlayerFullFrame />}
      {hostMode === 'mini' && <MiniPlayer />}
      {hostMode === 'pip'  && <PipSlot />}
    </div>,
    portalEl,
  )
}
