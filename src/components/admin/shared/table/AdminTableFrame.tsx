import type { ReactNode } from 'react'

interface AdminTableFrameProps {
  minWidth: number
  scrollTestId?: string
  children: ReactNode
}

export function AdminTableFrame({ minWidth, scrollTestId, children }: AdminTableFrameProps) {
  return (
    <div className="rounded-lg border border-[var(--border)] overflow-hidden">
      <div
        data-testid={scrollTestId}
        className="h-[60vh] min-h-[420px] max-h-[720px] overflow-y-auto overflow-x-auto"
      >
        <table className="w-full table-fixed text-sm" style={{ minWidth: `${minWidth}px` }}>
          {children}
        </table>
      </div>
    </div>
  )
}
