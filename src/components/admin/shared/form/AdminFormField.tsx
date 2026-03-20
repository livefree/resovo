import type { ReactNode } from 'react'

interface AdminFormFieldProps {
  label: string
  children: ReactNode
  className?: string
}

export function AdminFormField({ label, children, className }: AdminFormFieldProps) {
  return (
    <div className={className ?? 'mb-4'}>
      <label className="mb-1 block text-sm font-medium text-[var(--text)]">{label}</label>
      {children}
    </div>
  )
}
