'use client'

/**
 * CrawlerLaunchPanel.tsx — 采集发起面板（三模式统一入口）
 * UX-08: 批量采集 / 关键词搜索 / 单视频补源
 */

import { useCrawlerSites } from '@/components/admin/system/crawler-site/hooks/useCrawlerSites'
import { KeywordCrawlForm } from './KeywordCrawlForm'
import { SourceRefetchForm } from './SourceRefetchForm'

// ── 模式定义 ─────────────────────────────────────────────────────

type LaunchMode = 'batch' | 'keyword' | 'refetch'

const MODES: { id: LaunchMode; label: string; description: string }[] = [
  { id: 'batch', label: '批量采集', description: '按时间窗口拉取各站点最新内容' },
  { id: 'keyword', label: '关键词搜索', description: '以关键词搜索各站点并预览或入库' },
  { id: 'refetch', label: '单视频补源', description: '为已有视频从各站点补充播放源' },
]

// ── BatchCrawlForm ────────────────────────────────────────────────

import { useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { AdminButton } from '@/components/admin/shared/button/AdminButton'
import { AdminFormField } from '@/components/admin/shared/form/AdminFormField'
import { AdminSelect } from '@/components/admin/shared/form/AdminSelect'
import { notify } from '@/components/admin/shared/toast/useAdminToast'
import type { CrawlerSite } from '@/types'

interface TriggerRunResponse {
  data: {
    runId: string
    taskIds: string[]
    enqueuedSiteKeys: string[]
    skippedSiteKeys: string[]
  }
}

function BatchCrawlForm({ sites }: { sites: CrawlerSite[] }) {
  const [mode, setMode] = useState<'incremental' | 'full'>('incremental')
  const [selectedSiteKeys, setSelectedSiteKeys] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  function toggleSite(key: string) {
    setSelectedSiteKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  function toggleAll() {
    if (selectedSiteKeys.length === sites.length) {
      setSelectedSiteKeys([])
    } else {
      setSelectedSiteKeys(sites.map((s) => s.key))
    }
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const res = await apiClient.post<TriggerRunResponse>('/admin/crawler/runs', {
        triggerType: 'batch',
        mode,
        siteKeys: selectedSiteKeys.length > 0 ? selectedSiteKeys : undefined,
      })
      const { enqueuedSiteKeys, skippedSiteKeys } = res.data
      const msg = `采集任务已入队：${enqueuedSiteKeys.length} 个站点${skippedSiteKeys.length > 0 ? `，${skippedSiteKeys.length} 个跳过` : ''}`
      notify.success(msg)
    } catch (err) {
      const message = err instanceof Error ? err.message : '发起失败'
      notify.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5" data-testid="batch-crawl-form">
      <AdminFormField label="采集模式">
        <AdminSelect
          value={mode}
          onChange={(v) => setMode(v as 'incremental' | 'full')}
          options={[
            { value: 'incremental', label: '增量采集（最近 24h 更新）' },
            { value: 'full', label: '全量采集（全部重新拉取）' },
          ]}
        />
      </AdminFormField>

      <AdminFormField label="目标站点">
        <div className="space-y-2">
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs text-[var(--accent)] hover:underline"
            data-testid="toggle-all-sites"
          >
            {selectedSiteKeys.length === sites.length ? '取消全选' : '全选'}
          </button>
          <div className="flex flex-wrap gap-2" data-testid="site-checkboxes">
            {sites.map((site) => (
              <label
                key={site.key}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--bg3)]"
                data-testid={`site-checkbox-${site.key}`}
              >
                <input
                  type="checkbox"
                  checked={selectedSiteKeys.includes(site.key)}
                  onChange={() => toggleSite(site.key)}
                  className="accent-[var(--accent)]"
                />
                <span className="text-[var(--text)]">{site.name}</span>
              </label>
            ))}
            {sites.length === 0 && (
              <span className="text-xs text-[var(--muted)]">暂无可用站点</span>
            )}
          </div>
          <p className="text-xs text-[var(--muted)]">
            {selectedSiteKeys.length === 0 ? '未选择 = 使用全部启用站点' : `已选 ${selectedSiteKeys.length} 个站点`}
          </p>
        </div>
      </AdminFormField>

      <AdminButton
        variant="primary"
        onClick={handleSubmit}
        disabled={submitting}
        data-testid="batch-crawl-btn"
      >
        {submitting ? '发起中...' : '发起采集'}
      </AdminButton>
    </div>
  )
}

// ── CrawlerLaunchPanel ────────────────────────────────────────────

export function CrawlerLaunchPanel() {
  const [launchMode, setLaunchMode] = useState<LaunchMode>('batch')
  const { sites, loading } = useCrawlerSites()

  return (
    <div className="space-y-6" data-testid="crawler-launch-panel">
      {/* 模式选择器 */}
      <div
        className="flex gap-1 rounded-md border border-[var(--border)] bg-[var(--bg2)] p-1 w-fit"
        data-testid="launch-mode-selector"
      >
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setLaunchMode(m.id)}
            data-testid={`launch-mode-${m.id}`}
            title={m.description}
            className={`rounded px-4 py-2 text-sm transition-colors ${
              launchMode === m.id
                ? 'bg-[var(--accent)] text-black'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* 模式说明 */}
      <p className="text-xs text-[var(--muted)]" data-testid="launch-mode-desc">
        {MODES.find((m) => m.id === launchMode)?.description}
      </p>

      {loading ? (
        <p className="text-sm text-[var(--muted)]" data-testid="sites-loading">加载站点中...</p>
      ) : (
        <div data-testid="launch-form-container">
          {launchMode === 'batch' && <BatchCrawlForm sites={sites} />}
          {launchMode === 'keyword' && <KeywordCrawlForm sites={sites} />}
          {launchMode === 'refetch' && <SourceRefetchForm sites={sites} />}
        </div>
      )}
    </div>
  )
}
