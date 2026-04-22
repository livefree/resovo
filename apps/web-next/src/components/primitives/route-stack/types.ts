export interface RouteStackEntry {
  pathname: string
  timestamp: number
  depth: number
  historyKey?: string
}

export interface RouteStackState {
  entries: RouteStackEntry[]
  currentIndex: number
}

export interface RouteStackAPI {
  state: RouteStackState
  push: (pathname: string) => void
  pop: () => void
  reset: (pathname: string) => void
  indexOf: (pathname: string) => number
}

export interface RouteStackProps {
  rootPathname?: string
  children: React.ReactNode
}
