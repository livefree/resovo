'use client'

import { createContext, useContext, useMemo } from 'react'
import type { SharedElementProps, SharedElementRegistry } from './types'

const NoopRegistry: SharedElementRegistry = {
  register: () => () => {},
  unregister: () => {},
  query: () => null,
}

const SharedElementContext = createContext<SharedElementRegistry>(NoopRegistry)

export function SharedElementProvider({ children }: { children: React.ReactNode }) {
  // TODO: REG-M3-01 改为真实 Map-based registry + FLIP bridge
  const value = useMemo(() => NoopRegistry, [])
  return <SharedElementContext.Provider value={value}>{children}</SharedElementContext.Provider>
}

export function useSharedElementRegistry(): SharedElementRegistry {
  return useContext(SharedElementContext)
}

export function useSharedElement(id: string) {
  const registry = useSharedElementRegistry()
  return {
    register: (el: HTMLElement, role: SharedElementProps['role'] = 'auto') =>
      registry.register(id, el, role),
    unregister: () => registry.unregister(id),
  }
}
