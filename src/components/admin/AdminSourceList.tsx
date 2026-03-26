'use client'

import { SourceHealthAlert } from '@/components/admin/sources/SourceHealthAlert'
import { SourceTable } from '@/components/admin/sources/SourceTable'

export function AdminSourceList() {
  return (
    <div className="space-y-4" data-testid="admin-source-list-shell">
      <SourceHealthAlert />
      <SourceTable />
    </div>
  )
}
