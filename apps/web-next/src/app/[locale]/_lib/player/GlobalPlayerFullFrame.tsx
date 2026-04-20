'use client'

import { usePlayerStore } from '@/stores/playerStore'
import { PlayerShell } from '@/components/player/PlayerShell'

/**
 * full 态：从 store.hostOrigin 读取 slug，渲染 PlayerShell（portalMode）。
 * REG-M3-04 完成后，/watch 页面不再自渲染 PlayerShell，由此组件通过 Portal 渲染。
 */
export function GlobalPlayerFullFrame() {
  const hostOrigin = usePlayerStore((s) => s.hostOrigin)
  const isHydrated = usePlayerStore((s) => s.isHydrated)

  if (!isHydrated || !hostOrigin?.slug) return null

  return (
    <div
      data-testid="player-frame-full"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-player-host, 40)',
        background: 'var(--bg-canvas)',
        overflowY: 'auto',
        pointerEvents: 'all',
      }}
    >
      <PlayerShell slug={hostOrigin.slug} portalMode />
    </div>
  )
}
