import type { ReactNode } from 'react'

interface AdminDialogShellProps {
  title: string
  onClose: () => void
  children: ReactNode
  widthClassName?: string
}

export function AdminDialogShell({
  title,
  onClose,
  children,
  widthClassName = 'max-w-md',
}: AdminDialogShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className={`w-full ${widthClassName} rounded-xl border border-[var(--border)] bg-[var(--bg2)] p-6 shadow-xl`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
          <button onClick={onClose} className="text-xl leading-none text-[var(--muted)] hover:text-[var(--text)]">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
