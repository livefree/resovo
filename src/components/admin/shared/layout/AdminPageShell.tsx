import type { ReactNode } from 'react'

interface AdminPageShellProps {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  testId?: string
}

export function AdminPageShell({
  title,
  description,
  actions,
  children,
  className,
  testId,
}: AdminPageShellProps) {
  return (
    <section className={className ?? 'space-y-4'} data-testid={testId}>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="group relative">
            <h1 className={`text-2xl font-bold ${description ? 'cursor-help' : ''}`}>{title}</h1>
            {description ? (
              <div
                className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-[min(720px,90vw)] rounded-md border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-xs leading-5 text-[var(--muted)] opacity-0 shadow transition-opacity duration-150 group-hover:opacity-100"
                role="tooltip"
              >
                {description}
              </div>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      </div>
      {children}
    </section>
  )
}
