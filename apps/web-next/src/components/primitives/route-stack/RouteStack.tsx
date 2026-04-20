'use client'

import { createContext, useContext, useMemo } from 'react'
import type { RouteStackAPI, RouteStackProps } from './types'

const NoopAPI: RouteStackAPI = {
  state: { entries: [], currentIndex: -1 },
  push: () => {},
  pop: () => {},
  reset: () => {},
  indexOf: () => -1,
}

const RouteStackContext = createContext<RouteStackAPI>(NoopAPI)

export function RouteStack({ rootPathname, children }: RouteStackProps) {
  // TODO: M5 Tab Bar 上线时实装边缘滑动手势 + history sync
  // - SSR 阶段返回 empty entries，避免 hydration mismatch
  // - pointerdown 边缘 20px 检测 → pointermove 位移 → pointerup 速度阈值判定
  // - 与 Next.js router.back() / window.history 双向同步
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(() => NoopAPI, [])
  return <RouteStackContext.Provider value={value}>{children}</RouteStackContext.Provider>
}

export function useRouteStack(): RouteStackAPI {
  return useContext(RouteStackContext)
}
