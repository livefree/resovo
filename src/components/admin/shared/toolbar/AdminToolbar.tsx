import type { ReactNode } from 'react'

interface AdminToolbarProps {
  actions: ReactNode
  feedback?: ReactNode
  className?: string
}

export function AdminToolbar({ actions, feedback, className }: AdminToolbarProps) {
  return (
    <div className={['mb-4 flex flex-wrap items-center gap-2', className].filter(Boolean).join(' ')}>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
      {feedback ? <div className="ml-auto">{feedback}</div> : null}
    </div>
  )
}
