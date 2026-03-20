import type { ButtonHTMLAttributes, ReactNode } from 'react'

type AdminButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type AdminButtonSize = 'sm' | 'md'

interface AdminButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AdminButtonVariant
  size?: AdminButtonSize
  children: ReactNode
}

export function AdminButton({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...props
}: AdminButtonProps) {
  const variantClass = {
    primary: 'bg-[var(--accent)] text-black hover:opacity-90',
    secondary: 'border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg3)]',
    danger: 'border border-red-500/30 text-red-400 hover:bg-red-500/10',
    ghost: 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--bg3)]',
  }[variant]

  const sizeClass = {
    sm: 'rounded px-2 py-1 text-xs',
    md: 'rounded-md px-3 py-2 text-sm',
  }[size]

  return (
    <button
      className={`${sizeClass} ${variantClass} disabled:opacity-50 ${className ?? ''}`}
      {...props}
    >
      {children}
    </button>
  )
}
