interface AdminHoverHintProps {
  text: string
  testId?: string
}

export function AdminHoverHint({ text, testId }: AdminHoverHintProps) {
  return (
    <span className="group relative inline-flex items-center" data-testid={testId}>
      <span
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-[var(--border)] text-[10px] text-[var(--muted)]"
        aria-label="说明"
      >
        ?
      </span>
      <span className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-[min(560px,80vw)] rounded-md border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-xs leading-5 text-[var(--muted)] opacity-0 shadow transition-opacity duration-150 group-hover:opacity-100">
        {text}
      </span>
    </span>
  )
}
