/**
 * /admin/content — 投稿/字幕审核统一入口（Client Component）
 * CHG-29: Tab 切换投稿和字幕审核
 */

'use client'

import { useState } from 'react'
import { AdminPageShell } from '@/components/admin/shared/layout/AdminPageShell'
import { SubmissionTable } from '@/components/admin/content/SubmissionTable'
import { SubtitleTable } from '@/components/admin/content/SubtitleTable'

export default function AdminContentPage() {
  const [tab, setTab] = useState<'submissions' | 'subtitles'>('submissions')

  return (
    <AdminPageShell
      title="内容审核"
      description="统一处理投稿审核与字幕审核，按审核对象切换视图。"
      testId="admin-content-page"
    >
      <div className="mb-6 flex border-b border-[var(--border)]" data-testid="content-tabs">
        <button
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'submissions'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'
          }`}
          onClick={() => setTab('submissions')}
          data-testid="content-tab-submissions"
        >
          投稿审核
        </button>
        <button
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'subtitles'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'
          }`}
          onClick={() => setTab('subtitles')}
          data-testid="content-tab-subtitles"
        >
          字幕审核
        </button>
      </div>

      {tab === 'submissions' && <SubmissionTable />}
      {tab === 'subtitles' && <SubtitleTable />}
    </AdminPageShell>
  )
}
