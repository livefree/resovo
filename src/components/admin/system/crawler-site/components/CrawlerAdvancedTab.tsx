'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { useAdminToast } from '@/components/admin/shared/feedback/useAdminToast'
import { useCrawlerMonitor } from '@/components/admin/system/crawler-site/hooks/useCrawlerMonitor'
import { useCrawlerSites } from '@/components/admin/system/crawler-site/hooks/useCrawlerSites'
import { CrawlerSystemStatusStrip } from '@/components/admin/system/crawler-site/components/CrawlerSystemStatusStrip'
import { AutoCrawlSettingsPanel } from '@/components/admin/system/crawler-site/components/AutoCrawlSettingsPanel'
import { CrawlerRunPanel } from '@/components/admin/system/crawler-site/components/CrawlerRunPanel'

type TriggerType = 'single' | 'batch' | 'all'
type CrawlMode = 'incremental' | 'full'

interface TriggerRunResponse {
  data: {
    runId: string
    taskIds: string[]
    enqueuedSiteKeys: string[]
    skippedSiteKeys: string[]
  }
}

export function CrawlerAdvancedTab() {
  const { toast, showToast } = useAdminToast({ durationMs: 3500 })
  const { sites } = useCrawlerSites()
  const {
    systemStatus,
    runningRuns,
    stopAllPending,
    freezeSwitchPending,
    stopAll,
    setFreezeEnabled,
    pauseRun,
    resumeRun,
    cancelRun,
    refreshMonitor,
  } = useCrawlerMonitor({ showToast })

  const [triggerType, setTriggerType] = useState<TriggerType>('all')
  const [mode, setMode] = useState<CrawlMode>('incremental')
  const [selectedSiteKeys, setSelectedSiteKeys] = useState<string[]>([])
  const [siteSearch, setSiteSearch] = useState('')
  const [hoursAgo, setHoursAgo] = useState(24)
  const [timeoutSeconds, setTimeoutSeconds] = useState(900)
  const [submitting, setSubmitting] = useState(false)
  const [lastRunId, setLastRunId] = useState('')

  const siteKeySet = useMemo(() => new Set(sites.map((site) => site.key)), [sites])
  const filteredSites = useMemo(() => {
    const keyword = siteSearch.trim().toLowerCase()
    if (!keyword) return sites
    return sites.filter((site) =>
      `${site.name} ${site.key}`.toLowerCase().includes(keyword),
    )
  }, [siteSearch, sites])

  useEffect(() => {
    setSelectedSiteKeys((prev) => prev.filter((siteKey) => siteKeySet.has(siteKey)))
  }, [siteKeySet])

  useEffect(() => {
    if (triggerType !== 'single') return
    if (selectedSiteKeys.length > 0) return
    if (sites.length === 0) return
    setSelectedSiteKeys([sites[0].key])
  }, [triggerType, selectedSiteKeys, sites])

  function handleChangeTriggerType(next: TriggerType) {
    setTriggerType(next)
    setSiteSearch('')
    if (next === 'all') {
      setSelectedSiteKeys([])
      return
    }
    if (next === 'single') {
      setSelectedSiteKeys((prev) => {
        if (prev.length > 0) return [prev[0]]
        return sites.length > 0 ? [sites[0].key] : []
      })
      return
    }
    setSelectedSiteKeys((prev) => prev.filter((siteKey) => siteKeySet.has(siteKey)))
  }

  function toggleBatchSite(siteKey: string, checked: boolean) {
    setSelectedSiteKeys((prev) => {
      if (checked) {
        if (prev.includes(siteKey)) return prev
        return [...prev, siteKey]
      }
      return prev.filter((item) => item !== siteKey)
    })
  }

  async function handleTriggerCustomRun() {
    const payload: {
      triggerType: TriggerType
      mode: CrawlMode
      siteKeys?: string[]
      hoursAgo: number
      timeoutSeconds: number
    } = {
      triggerType,
      mode,
      hoursAgo: Math.max(1, Math.min(hoursAgo, 720)),
      timeoutSeconds: Math.max(60, Math.min(timeoutSeconds, 7200)),
    }

    if (triggerType === 'single' || triggerType === 'batch') {
      const siteKeys = triggerType === 'single'
        ? selectedSiteKeys.slice(0, 1)
        : selectedSiteKeys
      if (siteKeys.length === 0) {
        showToast('请先选择至少一个站点', false)
        return
      }
      const invalid = siteKeys.filter((siteKey) => !siteKeySet.has(siteKey))
      if (invalid.length > 0) {
        showToast(`存在无效站点 Key：${invalid.join(', ')}`, false)
        return
      }
      payload.siteKeys = siteKeys
    }

    setSubmitting(true)
    try {
      const res = await apiClient.post<TriggerRunResponse>('/admin/crawler/runs', payload)
      setLastRunId(res.data.runId)
      showToast('自定义采集任务已创建', true)
      await refreshMonitor()
    } catch {
      showToast('自定义采集任务创建失败', false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4" data-testid="crawler-advanced-tab">
      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg2)] px-3 py-2">
        <h3 className="text-sm font-semibold text-[var(--text)]">系统控制与策略配置</h3>
        <p className="mt-1 text-xs text-[var(--muted)]">
          在本页统一管理自动采集策略、批次控制能力与自定义任务创建。
        </p>
      </section>

      <CrawlerSystemStatusStrip
        data={systemStatus}
        stopAllPending={stopAllPending}
        freezeSwitchPending={freezeSwitchPending}
        onStopAll={() => { void stopAll() }}
        onSetFreezeEnabled={(enabled) => { void setFreezeEnabled(enabled) }}
      />

      <CrawlerRunPanel
        title="运行中任务控制"
        emptyText="当前没有可控制的运行任务"
        runs={runningRuns}
        onCancel={(runId) => { void cancelRun(runId) }}
        onPause={(runId) => { void pauseRun(runId) }}
        onResume={(runId) => { void resumeRun(runId) }}
      />

      <AutoCrawlSettingsPanel sites={sites} showToast={showToast} />

      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-4" data-testid="crawler-custom-run-builder">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text)]">自定义采集任务</h2>
          {lastRunId ? (
            <a
              href={`?tab=tasks&runId=${encodeURIComponent(lastRunId)}`}
              className="text-xs text-[var(--accent)] hover:underline"
              data-testid="crawler-custom-run-last-link"
            >
              查看最近批次 #{lastRunId.slice(0, 8)}
            </a>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs text-[var(--muted)]">
            触发范围
            <select
              value={triggerType}
              onChange={(event) => handleChangeTriggerType(event.target.value as TriggerType)}
              className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--text)]"
              data-testid="crawler-custom-run-trigger-type"
            >
              <option value="all">全站</option>
              <option value="batch">批量</option>
              <option value="single">单站</option>
            </select>
          </label>

          <label className="text-xs text-[var(--muted)]">
            采集模式
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as CrawlMode)}
              className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--text)]"
              data-testid="crawler-custom-run-mode"
            >
              <option value="incremental">增量</option>
              <option value="full">全量</option>
            </select>
          </label>

          <label className="text-xs text-[var(--muted)]">
            增量回溯小时
            <input
              type="number"
              min={1}
              max={720}
              value={hoursAgo}
              onChange={(event) => setHoursAgo(Number(event.target.value) || 24)}
              className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--text)]"
              data-testid="crawler-custom-run-hours-ago"
            />
          </label>

          <label className="text-xs text-[var(--muted)]">
            超时秒数
            <input
              type="number"
              min={60}
              max={7200}
              value={timeoutSeconds}
              onChange={(event) => setTimeoutSeconds(Number(event.target.value) || 900)}
              className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--text)]"
              data-testid="crawler-custom-run-timeout-seconds"
            />
          </label>
        </div>

        {triggerType === 'single' ? (
          <label className="mt-3 block text-xs text-[var(--muted)]">
            站点选择（单选）
            <select
              value={selectedSiteKeys[0] ?? ''}
              onChange={(event) => setSelectedSiteKeys(event.target.value ? [event.target.value] : [])}
              className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--text)]"
              data-testid="crawler-custom-run-site-single"
            >
              {sites.map((site) => (
                <option key={site.key} value={site.key}>
                  {site.name} ({site.key})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {triggerType === 'batch' ? (
          <div className="mt-3 rounded border border-[var(--border)] bg-[var(--bg3)] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="text-xs text-[var(--muted)]">
                站点搜索
                <input
                  type="text"
                  value={siteSearch}
                  onChange={(event) => setSiteSearch(event.target.value)}
                  placeholder="按名称或 Key 搜索"
                  className="mt-1 w-72 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--text)]"
                  data-testid="crawler-custom-run-site-search"
                />
              </label>
              <button
                type="button"
                onClick={() => setSelectedSiteKeys([])}
                className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)]"
                data-testid="crawler-custom-run-site-clear"
              >
                清空选择
              </button>
            </div>

            <div className="mb-2 text-xs text-[var(--muted)]">
              已选 {selectedSiteKeys.length} 个站点
            </div>

            <div className="mb-2 flex flex-wrap gap-1">
              {selectedSiteKeys.map((siteKey) => (
                <button
                  key={siteKey}
                  type="button"
                  onClick={() => toggleBatchSite(siteKey, false)}
                  className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-0.5 text-xs text-[var(--text)]"
                  data-testid={`crawler-custom-run-selected-${siteKey}`}
                >
                  {siteKey} ×
                </button>
              ))}
            </div>

            <div className="max-h-52 overflow-y-auto rounded border border-[var(--border)] bg-[var(--bg)] p-2">
              {filteredSites.length === 0 ? (
                <p className="text-xs text-[var(--muted)]">没有匹配站点</p>
              ) : (
                filteredSites.map((site) => {
                  const checked = selectedSiteKeys.includes(site.key)
                  return (
                    <label key={site.key} className="mb-1 flex items-center gap-2 text-xs text-[var(--text)]">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => toggleBatchSite(site.key, event.target.checked)}
                        className="accent-[var(--accent)]"
                        data-testid={`crawler-custom-run-site-item-${site.key}`}
                      />
                      <span>{site.name}</span>
                      <span className="text-[var(--muted)]">{site.key}</span>
                    </label>
                  )
                })
              )}
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => { void handleTriggerCustomRun() }}
            disabled={submitting}
            className="rounded bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-50"
            data-testid="crawler-custom-run-submit"
          >
            {submitting ? '创建中…' : '创建自定义任务'}
          </button>
          {toast ? (
            <span className={`text-xs ${toast.ok ? 'text-green-400' : 'text-red-400'}`}>{toast.msg}</span>
          ) : null}
        </div>
      </section>
    </div>
  )
}
