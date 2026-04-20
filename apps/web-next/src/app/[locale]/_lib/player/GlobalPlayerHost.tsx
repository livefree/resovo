'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePlayerStore } from '@/stores/playerStore'
import { GlobalPlayerFullFrame } from './GlobalPlayerFullFrame'

const PORTAL_ID = 'global-player-host-portal'

function PlaceholderSlot({ mode }: { mode: string }) {
  return (
    <div
      data-testid={`global-player-${mode}-placeholder`}
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
      {/* TODO: REG-M3-02 填充 mini 态 UI */}
      {hostMode === 'mini' && <PlaceholderSlot mode="mini" />}
      {/* TODO: REG-M3-03 填充 pip 态 */}
      {hostMode === 'pip'  && <PlaceholderSlot mode="pip" />}
    </div>,
    portalEl,
  )
}
