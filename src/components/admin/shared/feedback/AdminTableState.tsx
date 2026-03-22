interface AdminTableStateProps {
  isLoading?: boolean
  isEmpty: boolean
  colSpan: number
  loadingText?: string
  emptyText: string
}

export function AdminTableState({
  isLoading = false,
  isEmpty,
  colSpan,
  loadingText = '加载中…',
  emptyText,
}: AdminTableStateProps) {
  if (isLoading) {
    return (
      <tr>
        <td colSpan={colSpan} className="px-3 py-10 text-center text-[var(--muted)] text-sm">
          {loadingText}
        </td>
      </tr>
    )
  }

  if (!isEmpty) {
    return null
  }

  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-10 text-center text-[var(--muted)] text-sm">
        {emptyText}
      </td>
    </tr>
  )
}
