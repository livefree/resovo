'use client'

import { createContext, useContext, useMemo, useRef } from 'react'
import type { RouteStackAPI, RouteStackProps } from './types'
import { useEdgeSwipeBack } from '@/hooks/useEdgeSwipeBack'

const NoopAPI: RouteStackAPI = {
  state: { entries: [], currentIndex: -1 },
  push: () => {},
  pop: () => {},
  reset: () => {},
  indexOf: () => -1,
}

const RouteStackContext = createContext<RouteStackAPI>(NoopAPI)

export function RouteStack({ rootPathname: _rootPathname, children }: RouteStackProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  useEdgeSwipeBack(containerRef)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(() => NoopAPI, [])
  return (
    <RouteStackContext.Provider value={value}>
      <div ref={containerRef} style={{ display: 'contents' }}>
        {children}
      </div>
    </RouteStackContext.Provider>
  )
}

export function useRouteStack(): RouteStackAPI {
  return useContext(RouteStackContext)
}
