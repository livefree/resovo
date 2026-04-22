'use client'

import { createContext, useContext } from 'react'
import type { SharedElementRegistry, SharedElementProps } from './types'

type Role = NonNullable<SharedElementProps['role']>
type Snapshot = { rect: DOMRect; capturedAt: number }
type Entry = { element: WeakRef<HTMLElement>; role: Role; snapshot: Snapshot | null }

const MAX_ENTRIES = 64
const SNAPSHOT_TTL_MS = 500

// Client-only singleton attached to window to survive HMR without duplication.
// Returns an empty dead Map on the server (never written — 'use client' ensures
// this module is excluded from the server bundle, but guard defensively).
function getMap(): Map<string, Entry> {
  if (typeof window === 'undefined') return new Map()
  const w = window as Window & { __resovoSharedElementMap?: Map<string, Entry> }
  return (w.__resovoSharedElementMap ??= new Map())
}

// ── public helpers ────────────────────────────────────────────────────────────

/**
 * Eagerly captures the element's current rect as a FLIP snapshot.
 * Must be called on navigation intent (onPointerDown / onClick) so the rect
 * is captured before the source element unmounts or is transformed.
 */
export function captureSnapshot(id: string): void {
  const map = getMap()
  const entry = map.get(id)
  const el = entry?.element.deref()
  if (!entry || !el || !el.isConnected) return
  entry.snapshot = { rect: el.getBoundingClientRect(), capturedAt: performance.now() }
  // Opportunistic LRU prune: delete the oldest entry when over the cap
  if (map.size > MAX_ENTRIES) {
    const firstKey = map.keys().next().value
    if (firstKey !== undefined) map.delete(firstKey)
  }
}

/**
 * Consumes and clears the snapshot for a given id.
 * Returns null if no snapshot exists or if it is older than SNAPSHOT_TTL_MS.
 */
export function consumeSnapshot(id: string): Snapshot | null {
  const entry = getMap().get(id)
  if (!entry?.snapshot) return null
  const snap = entry.snapshot
  entry.snapshot = null
  if (performance.now() - snap.capturedAt > SNAPSHOT_TTL_MS) return null
  return snap
}

// ── registry singleton ────────────────────────────────────────────────────────

const noopRegistry: SharedElementRegistry = {
  register: () => () => {},
  unregister: () => {},
  query: () => null,
}

export const registry: SharedElementRegistry = {
  register(id, el, role = 'auto') {
    const map = getMap()
    const existing = map.get(id)
    map.set(id, {
      element: new WeakRef(el),
      role: (role ?? 'auto') as Role,
      snapshot: existing?.snapshot ?? null,
    })
    // LRU prune: evict oldest entry when over the cap
    if (map.size > MAX_ENTRIES) {
      const firstKey = map.keys().next().value
      if (firstKey !== undefined) map.delete(firstKey)
    }
    return () => {
      const cur = map.get(id)
      if (cur?.element.deref() === el) map.delete(id)
    }
  },
  unregister(id) {
    getMap().delete(id)
  },
  query(id) {
    const entry = getMap().get(id)
    const el = entry?.element.deref()
    if (!entry || !el) return null
    return { element: el, role: entry.role }
  },
}

// ── context ───────────────────────────────────────────────────────────────────

const SharedElementContext = createContext<SharedElementRegistry>(registry)

/**
 * Provides the SharedElement registry to the subtree.
 * Pass `enabled={false}` to opt out (e.g., in embedded players or iframes).
 */
export function SharedElementProvider({
  children,
  enabled = true,
}: {
  children: React.ReactNode
  enabled?: boolean
}) {
  return (
    <SharedElementContext.Provider value={enabled ? registry : noopRegistry}>
      {children}
    </SharedElementContext.Provider>
  )
}

export function useSharedElementRegistry(): SharedElementRegistry {
  return useContext(SharedElementContext)
}

export function useSharedElement(id: string) {
  const reg = useSharedElementRegistry()
  return {
    register: (el: HTMLElement, role: SharedElementProps['role'] = 'auto') =>
      reg.register(id, el, role),
    unregister: () => reg.unregister(id),
  }
}
