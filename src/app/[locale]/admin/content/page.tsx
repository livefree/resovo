/**
 * /admin/content — 投稿/字幕审核统一入口（Client Component）
 * CHG-29: Tab 切换投稿和字幕审核
 */

'use client'

import { useState } from 'react'
import { SubmissionTable } from '@/components/admin/content/SubmissionTable'
import { SubtitleTable } from '@/components/admin/content/SubtitleTable'

export default function AdminContentPage() {
  const [tab, setTab] = useState<'submissions' | 'subtitles'>('submissions')

  return (
    <div data-testid="admin-content-page">
      <h1 className="mb-6 text-2xl font-bold">内容审核</h1>

      {/* Tab 切换 */}
      <div className="mb-6 flex border-b border-[var(--border)]" data-testid="content-tabs">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
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
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
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
    </div>
  )
}
