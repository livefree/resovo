/**
 * SourceTable.tsx — 播放源管理表格骨架（CHG-229 拆分）
 * Tab 切换：全部源 / 失效源（InactiveSourceTable）/ 用户纠错（SubmissionTable）
 */

'use client'

import { useState } from 'react'
import { AdminToolbar } from '@/components/admin/shared/toolbar/AdminToolbar'
import { InactiveSourceTable } from '@/components/admin/sources/InactiveSourceTable'
import { SubmissionTable } from '@/components/admin/sources/SubmissionTable'

type SourceTab = 'all' | 'inactive' | 'submissions'

export function SourceTable() {
  const [activeTab, setActiveTab] = useState<SourceTab>('all')

  return (
    <div data-testid="source-table" className="space-y-2">
      <AdminToolbar
        className="gap-3"
        actions={(
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-md border border-[var(--border)] bg-[var(--bg3)] p-0.5">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`rounded px-3 py-1 text-sm ${activeTab === 'all' ? 'bg-[var(--accent)] text-black' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
                data-testid="source-tab-all"
              >全部源</button>
              <button
                type="button"
                onClick={() => setActiveTab('inactive')}
                className={`rounded px-3 py-1 text-sm ${activeTab === 'inactive' ? 'bg-[var(--accent)] text-black' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
                data-testid="source-tab-inactive"
              >失效源</button>
              <button
                type="button"
                onClick={() => setActiveTab('submissions')}
                className={`rounded px-3 py-1 text-sm ${activeTab === 'submissions' ? 'bg-[var(--accent)] text-black' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
                data-testid="source-tab-submissions"
              >用户纠错</button>
            </div>
          </div>
        )}
      />

      {activeTab === 'all' ? <InactiveSourceTable key="all" status="all" /> : null}
      {activeTab === 'inactive' ? <InactiveSourceTable key="inactive" status="inactive" /> : null}
      {activeTab === 'submissions' ? <SubmissionTable /> : null}
    </div>
  )
}
