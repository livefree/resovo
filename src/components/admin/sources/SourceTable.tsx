/**
 * SourceTable.tsx — 播放源管理表格骨架（CHG-229 拆分）
 * Tab 切换：全部源 / 失效源（InactiveSourceTable）/ 用户纠错（SubmissionTable）
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AdminToolbar } from '@/components/admin/shared/toolbar/AdminToolbar'
import { InactiveSourceTable } from '@/components/admin/sources/InactiveSourceTable'
import { SubmissionTable } from '@/components/admin/sources/SubmissionTable'

type SourceTab = 'all' | 'inactive' | 'submissions'
type SourceSortField = 'created_at' | 'last_checked' | 'is_active' | 'video_title' | 'source_url' | 'site_key'
type SourceSortDir = 'asc' | 'desc'

const SOURCE_TAB_QUERY_KEY = 'sourceTab'

function parseTab(input: string | null): SourceTab {
  if (input === 'inactive' || input === 'submissions') return input
  return 'all'
}

function parseSortField(input: string | null): SourceSortField | '' {
  if (
    input === 'created_at'
    || input === 'last_checked'
    || input === 'is_active'
    || input === 'video_title'
    || input === 'source_url'
    || input === 'site_key'
  ) {
    return input
  }
  return ''
}

function parseSortDir(input: string | null): SourceSortDir {
  return input === 'asc' ? 'asc' : 'desc'
}

export function SourceTable() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const queryTab = searchParams.get(SOURCE_TAB_QUERY_KEY)
  const queryKeyword = searchParams.get('keyword') ?? ''
  const queryTitle = searchParams.get('title') ?? ''
  const queryVideoId = searchParams.get('videoId') ?? ''
  const querySiteKey = searchParams.get('siteKey') ?? ''
  const querySortField = parseSortField(searchParams.get('sortField'))
  const querySortDir = parseSortDir(searchParams.get('sortDir'))

  const [activeTab, setActiveTab] = useState<SourceTab>(parseTab(queryTab))
  const [keyword, setKeyword] = useState(queryKeyword)
  const [title, setTitle] = useState(queryTitle)
  const [videoId, setVideoId] = useState(queryVideoId)
  const [siteKey, setSiteKey] = useState(querySiteKey)
  const [sortField, setSortField] = useState<SourceSortField | ''>(querySortField)
  const [sortDir, setSortDir] = useState<SourceSortDir>(querySortDir)

  useEffect(() => {
    setActiveTab(parseTab(queryTab))
  }, [queryTab])

  useEffect(() => {
    setKeyword(queryKeyword)
  }, [queryKeyword])

  useEffect(() => {
    setTitle(queryTitle)
  }, [queryTitle])

  useEffect(() => {
    setVideoId(queryVideoId)
  }, [queryVideoId])

  useEffect(() => {
    setSiteKey(querySiteKey)
  }, [querySiteKey])

  useEffect(() => {
    setSortField(querySortField)
  }, [querySortField])

  useEffect(() => {
    setSortDir(querySortDir)
  }, [querySortDir])

  function replaceParams(nextParams: URLSearchParams) {
    const query = nextParams.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString())
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    replaceParams(next)
  }

  function handleTabChange(nextTab: SourceTab) {
    setActiveTab(nextTab)
    const next = new URLSearchParams(searchParams.toString())
    if (nextTab === 'all') {
      next.delete(SOURCE_TAB_QUERY_KEY)
    } else {
      next.set(SOURCE_TAB_QUERY_KEY, nextTab)
    }
    replaceParams(next)
  }

  const sourceFilters = useMemo(
    () => ({
      keyword: keyword.trim() || undefined,
      title: title.trim() || undefined,
      videoId: videoId.trim() || undefined,
      siteKey: siteKey.trim() || undefined,
      sortField: sortField || undefined,
      sortDir: sortField ? sortDir : undefined,
    }),
    [keyword, siteKey, sortDir, sortField, title, videoId],
  )

  return (
    <div data-testid="source-table" className="space-y-2">
      <AdminToolbar
        className="gap-3"
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-md border border-[var(--border)] bg-[var(--bg3)] p-0.5">
              <button
                type="button"
                onClick={() => handleTabChange('all')}
                className={`rounded px-3 py-1 text-sm ${activeTab === 'all' ? 'bg-[var(--accent)] text-black' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
                data-testid="source-tab-all"
              >全部源</button>
              <button
                type="button"
                onClick={() => handleTabChange('inactive')}
                className={`rounded px-3 py-1 text-sm ${activeTab === 'inactive' ? 'bg-[var(--accent)] text-black' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
                data-testid="source-tab-inactive"
              >失效源</button>
              <button
                type="button"
                onClick={() => handleTabChange('submissions')}
                className={`rounded px-3 py-1 text-sm ${activeTab === 'submissions' ? 'bg-[var(--accent)] text-black' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
                data-testid="source-tab-submissions"
              >用户纠错</button>
            </div>

            {activeTab !== 'submissions' ? (
              <>
                <input
                  type="text"
                  value={keyword}
                  placeholder="关键词（URL/标题）"
                  onChange={(e) => {
                    const next = e.target.value
                    setKeyword(next)
                    updateParam('keyword', next.trim())
                  }}
                  className="rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--muted)]"
                  data-testid="source-filters-keyword"
                />
                <input
                  type="text"
                  value={title}
                  placeholder="视频标题"
                  onChange={(e) => {
                    const next = e.target.value
                    setTitle(next)
                    updateParam('title', next.trim())
                  }}
                  className="rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--muted)]"
                  data-testid="source-filters-title"
                />
                <input
                  type="text"
                  value={videoId}
                  placeholder="视频ID（UUID）"
                  onChange={(e) => {
                    const next = e.target.value
                    setVideoId(next)
                    updateParam('videoId', next.trim())
                  }}
                  className="rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--muted)]"
                  data-testid="source-filters-video-id"
                />
                <input
                  type="text"
                  value={siteKey}
                  placeholder="来源站点（siteKey）"
                  onChange={(e) => {
                    const next = e.target.value
                    setSiteKey(next)
                    updateParam('siteKey', next.trim())
                  }}
                  className="rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--muted)]"
                  data-testid="source-filters-site-key"
                />
                <select
                  value={sortField}
                  onChange={(e) => {
                    const next = e.target.value as SourceSortField | ''
                    setSortField(next)
                    updateParam('sortField', next)
                    if (!next) {
                      updateParam('sortDir', '')
                    }
                  }}
                  className="rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-1.5 text-sm text-[var(--text)]"
                  data-testid="source-filters-sort-field"
                >
                  <option value="">默认排序</option>
                  <option value="created_at">创建时间</option>
                  <option value="last_checked">最后验证</option>
                  <option value="is_active">状态</option>
                  <option value="video_title">视频标题</option>
                  <option value="source_url">源 URL</option>
                  <option value="site_key">来源站点</option>
                </select>
                <select
                  value={sortDir}
                  onChange={(e) => {
                    const next = e.target.value as SourceSortDir
                    setSortDir(next)
                    updateParam('sortDir', next)
                  }}
                  className="rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-1.5 text-sm text-[var(--text)]"
                  data-testid="source-filters-sort-dir"
                  disabled={!sortField}
                >
                  <option value="desc">降序</option>
                  <option value="asc">升序</option>
                </select>
              </>
            ) : null}
          </div>
        )}
      />

      {activeTab === 'all' ? <InactiveSourceTable key="all" status="all" {...sourceFilters} /> : null}
      {activeTab === 'inactive' ? <InactiveSourceTable key="inactive" status="inactive" {...sourceFilters} /> : null}
      {activeTab === 'submissions' ? <SubmissionTable /> : null}
    </div>
  )
}
