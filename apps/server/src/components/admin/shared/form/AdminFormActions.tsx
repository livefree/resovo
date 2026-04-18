import type { ReactNode } from 'react'

interface AdminFormActionsProps {
  children: ReactNode
}

export function AdminFormActions({ children }: AdminFormActionsProps) {
  return <div className="flex justify-end gap-3">{children}</div>
}
