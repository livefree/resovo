export interface AdminSelectOption<T extends string = string> {
  value: T
  label: string
}

interface AdminSelectProps<T extends string = string> {
  value: T
  options: AdminSelectOption<T>[]
  onChange: (value: T) => void
}

export function AdminSelect<T extends string = string>({
  value,
  options,
  onChange,
}: AdminSelectProps<T>) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className="w-full rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
