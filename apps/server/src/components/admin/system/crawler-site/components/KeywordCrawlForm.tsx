'use client'

/**
 * KeywordCrawlForm.tsx — 关键词搜索采集表单
 * UX-08: 搜索词 + 站点多选 → [搜索并预览] / [直接采集]
 */

import { useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { AdminButton } from '@/components/admin/shared/button/AdminButton'
import { AdminInput } from '@/components/admin/shared/form/AdminInput'
import { AdminFormField } from '@/components/admin/shared/form/AdminFormField'
import { notify } from '@/components/admin/shared/toast/useAdminToast'
import { KeywordPreviewTable, type KeywordPreviewResult } from './KeywordPreviewTable'
import type { CrawlerSite } from '@/types'

interface KeywordCrawlFormProps {
  sites: CrawlerSite[]
}

interface KeywordPreviewResponse {
  data: {
    keyword: string
    results: KeywordPreviewResult[]
  }
}

interface TriggerRunResponse {
  data: {
    runId: string
    taskIds: string[]
    enqueuedSiteKeys: string[]
    skippedSiteKeys: string[]
  }
}

export function KeywordCrawlForm({ sites }: KeywordCrawlFormProps) {
  const [keyword, setKeyword] = useState('')
  const [selectedSiteKeys, setSelectedSiteKeys] = useState<string[]>([])
  const [previewResults, setPreviewResults] = useState<KeywordPreviewResult[]>([])
  const [previewing, setPreviewing] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function toggleSite(key: string) {
    setSelectedSiteKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  function toggleAllSites() {
    if (selectedSiteKeys.length === sites.length) {
      setSelectedSiteKeys([])
    } else {
      setSelectedSiteKeys(sites.map((s) => s.key))
    }
  }

  async function handlePreview() {
    const kw = keyword.trim()
    if (!kw) {
      notify.warn('请输入搜索关键词')
      return
    }
    setPreviewing(true)
    setPreviewResults([])
    try {
      const res = await apiClient.post<KeywordPreviewResponse>('/admin/crawler/keyword-preview', {
        keyword: kw,
        siteKeys: selectedSiteKeys.length > 0 ? selectedSiteKeys : undefined,
      })
      setPreviewResults(res.data.results)
    } catch (err) {
      const message = err instanceof Error ? err.message : '预览失败'
      notify.error(message)
    } finally {
      setPreviewing(false)
    }
  }

  async function handleCrawl() {
    const kw = keyword.trim()
    if (!kw) {
      notify.warn('请输入搜索关键词')
      return
    }
    setSubmitting(true)
    try {
      const res = await apiClient.post<TriggerRunResponse>('/admin/crawler/runs', {
        triggerType: 'batch',
        mode: 'incremental',
        siteKeys: selectedSiteKeys.length > 0 ? selectedSiteKeys : undefined,
        crawlMode: 'keyword',
        keyword: kw,
      })
      const { enqueuedSiteKeys, skippedSiteKeys } = res.data
      const msg = `关键词采集已入队：${enqueuedSiteKeys.length} 个站点${skippedSiteKeys.length > 0 ? `，${skippedSiteKeys.length} 个跳过` : ''}`
      notify.success(msg)
    } catch (err) {
      const message = err instanceof Error ? err.message : '发起采集失败'
      notify.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5" data-testid="keyword-crawl-form">
      <AdminFormField label="搜索关键词">
        <div data-testid="keyword-input">
          <AdminInput
            value={keyword}
            onChange={setKeyword}
            placeholder="输入视频标题关键词"
          />
        </div>
      </AdminFormField>

      <AdminFormField label="目标站点">
        <div className="space-y-2">
          <button
            type="button"
            onClick={toggleAllSites}
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

      <div className="flex gap-2">
        <AdminButton
          variant="secondary"
          onClick={handlePreview}
          disabled={previewing || submitting}
          data-testid="preview-btn"
        >
          {previewing ? '搜索中...' : '搜索并预览'}
        </AdminButton>
        <AdminButton
          variant="primary"
          onClick={handleCrawl}
          disabled={submitting || previewing}
          data-testid="crawl-btn"
        >
          {submitting ? '发起中...' : '直接采集'}
        </AdminButton>
      </div>

      {previewResults.length > 0 && (
        <div data-testid="preview-results-section">
          <p className="mb-2 text-xs text-[var(--muted)]">预览结果（只读，不写库）</p>
          <KeywordPreviewTable results={previewResults} />
        </div>
      )}
    </div>
  )
}
