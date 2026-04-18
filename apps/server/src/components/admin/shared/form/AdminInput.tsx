interface AdminInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  type?: string
}

export function AdminInput({
  value,
  onChange,
  placeholder,
  disabled,
  type = 'text',
}: AdminInputProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50"
    />
  )
}
