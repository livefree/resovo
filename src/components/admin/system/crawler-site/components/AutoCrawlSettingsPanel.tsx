import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import type { CrawlerSite } from '@/types'

type AutoCrawlMode = 'incremental' | 'full'
type AutoCrawlConflictPolicy = 'skip_running' | 'queue_after_running'

interface AutoCrawlSiteOverride {
  enabled: boolean
  mode: 'inherit' | AutoCrawlMode
}

interface AutoCrawlConfig {
  globalEnabled: boolean
  scheduleType: 'daily'
  dailyTime: string
  defaultMode: AutoCrawlMode
  onlyEnabledSites: boolean
  conflictPolicy: AutoCrawlConflictPolicy
  perSiteOverrides: Record<string, AutoCrawlSiteOverride>
}

interface AutoCrawlSettingsPanelProps {
  sites: CrawlerSite[]
  showToast: (message: string, ok: boolean) => void
  onConfigChange?: (config: AutoCrawlConfig) => void
}

const DEFAULT_AUTO_CRAWL_CONFIG: AutoCrawlConfig = {
  globalEnabled: false,
  scheduleType: 'daily',
  dailyTime: '03:00',
  defaultMode: 'incremental',
  onlyEnabledSites: true,
  conflictPolicy: 'skip_running',
  perSiteOverrides: {},
}

function normalizeConfig(input: Partial<AutoCrawlConfig> | null | undefined): AutoCrawlConfig {
  if (!input) return DEFAULT_AUTO_CRAWL_CONFIG
  return {
    ...DEFAULT_AUTO_CRAWL_CONFIG,
    ...input,
    scheduleType: 'daily',
    defaultMode: input.defaultMode === 'full' ? 'full' : 'incremental',
    conflictPolicy: input.conflictPolicy === 'queue_after_running' ? 'queue_after_running' : 'skip_running',
    perSiteOverrides: input.perSiteOverrides ?? {},
  }
}

export function AutoCrawlSettingsPanel({ sites, showToast, onConfigChange }: AutoCrawlSettingsPanelProps) {
  const [config, setConfig] = useState<AutoCrawlConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedOverrideKey, setSelectedOverrideKey] = useState('')

  const siteOptions = useMemo(
    () => sites.map((site) => ({ key: site.key, label: `${site.name} (${site.key})` })),
    [sites],
  )

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ data: Partial<AutoCrawlConfig> }>('/admin/crawler/auto-config')
      const normalized = normalizeConfig(res.data)
      setConfig(normalized)
      onConfigChange?.(normalized)
      if (!selectedOverrideKey && siteOptions.length > 0) {
        setSelectedOverrideKey(siteOptions[0].key)
      }
    } catch {
      showToast('自动采集配置加载失败', false)
    } finally {
      setLoading(false)
    }
  }, [onConfigChange, selectedOverrideKey, showToast, siteOptions])

  async function saveConfig() {
    if (!config) return
    setSaving(true)
    try {
      await apiClient.post('/admin/crawler/auto-config', normalizeConfig(config))
      onConfigChange?.(normalizeConfig(config))
      showToast('自动采集配置已保存', true)
    } catch {
      showToast('自动采集配置保存失败', false)
    } finally {
      setSaving(false)
    }
  }

  const init = normalizeConfig(config)

  const selectedOverride = selectedOverrideKey ? init.perSiteOverrides[selectedOverrideKey] : undefined

  useEffect(() => {
    void fetchConfig()
  }, [fetchConfig])

  return (
    <section className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-4" data-testid="crawler-auto-crawl-settings">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text)]">自动采集设置</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { void fetchConfig() }}
            className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)]"
            data-testid="crawler-auto-config-refresh"
          >
            刷新
          </button>
          <button
            type="button"
            onClick={() => { void saveConfig() }}
            disabled={saving || !config}
            className="rounded bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-black disabled:opacity-50"
            data-testid="crawler-auto-config-save"
          >
            {saving ? '保存中…' : '保存自动采集'}
          </button>
        </div>
      </div>

      {!config && (
        <div className="rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--muted)]">
          {loading ? '加载中…' : '尚未加载自动采集配置，请先点击刷新。'}
        </div>
      )}

      {config && (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center justify-between rounded border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm">
              <span className="text-[var(--text)]">全局自动采集</span>
              <input
                type="checkbox"
                checked={init.globalEnabled}
                onChange={(e) => setConfig((prev) => prev ? { ...prev, globalEnabled: e.target.checked } : prev)}
                className="accent-[var(--accent)]"
                data-testid="crawler-auto-global-enabled"
              />
            </label>

            <label className="rounded border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm">
              <span className="mr-2 text-[var(--text)]">每日触发时间</span>
              <input
                type="time"
                value={init.dailyTime}
                onChange={(e) => setConfig((prev) => prev ? { ...prev, dailyTime: e.target.value } : prev)}
                className="rounded border border-[var(--border)] bg-[var(--bg2)] px-2 py-1 text-xs"
                data-testid="crawler-auto-daily-time"
              />
            </label>

            <label className="rounded border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm">
              <span className="mr-2 text-[var(--text)]">默认采集模式</span>
              <select
                value={init.defaultMode}
                onChange={(e) => setConfig((prev) => prev ? { ...prev, defaultMode: e.target.value as AutoCrawlMode } : prev)}
                className="rounded border border-[var(--border)] bg-[var(--bg2)] px-2 py-1 text-xs"
                data-testid="crawler-auto-default-mode"
              >
                <option value="incremental">增量</option>
                <option value="full">全量</option>
              </select>
            </label>

            <label className="flex items-center justify-between rounded border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm">
              <span className="text-[var(--text)]">仅采集启用站点</span>
              <input
                type="checkbox"
                checked={init.onlyEnabledSites}
                onChange={(e) => setConfig((prev) => prev ? { ...prev, onlyEnabledSites: e.target.checked } : prev)}
                className="accent-[var(--accent)]"
                data-testid="crawler-auto-only-enabled-sites"
              />
            </label>
          </div>

          <label className="block rounded border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm">
            <span className="mr-2 text-[var(--text)]">冲突策略</span>
            <select
              value={init.conflictPolicy}
              onChange={(e) => setConfig((prev) => prev ? { ...prev, conflictPolicy: e.target.value as AutoCrawlConflictPolicy } : prev)}
              className="rounded border border-[var(--border)] bg-[var(--bg2)] px-2 py-1 text-xs"
              data-testid="crawler-auto-conflict-policy"
            >
              <option value="skip_running">跳过运行中站点（推荐）</option>
              <option value="queue_after_running">排队等待运行中结束（预留）</option>
            </select>
          </label>

          <div className="rounded border border-[var(--border)] bg-[var(--bg3)] px-3 py-2">
            <p className="mb-2 text-xs font-medium text-[var(--text)]">单站覆盖（可选）</p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedOverrideKey}
                onChange={(e) => setSelectedOverrideKey(e.target.value)}
                className="rounded border border-[var(--border)] bg-[var(--bg2)] px-2 py-1 text-xs"
                data-testid="crawler-auto-override-site"
              >
                {siteOptions.map((site) => (
                  <option key={site.key} value={site.key}>{site.label}</option>
                ))}
              </select>
              {selectedOverrideKey && (
                <>
                  <label className="inline-flex items-center gap-1 text-xs text-[var(--text)]">
                    <input
                      type="checkbox"
                      checked={selectedOverride?.enabled ?? false}
                      onChange={(e) => {
                        const next = {
                          ...(init.perSiteOverrides ?? {}),
                          [selectedOverrideKey]: {
                            enabled: e.target.checked,
                            mode: selectedOverride?.mode ?? 'inherit',
                          },
                        }
                        setConfig((prev) => prev ? { ...prev, perSiteOverrides: next } : prev)
                      }}
                      className="accent-[var(--accent)]"
                    />
                    启用覆盖
                  </label>
                  <select
                    value={selectedOverride?.mode ?? 'inherit'}
                    onChange={(e) => {
                      const next = {
                        ...(init.perSiteOverrides ?? {}),
                        [selectedOverrideKey]: {
                          enabled: selectedOverride?.enabled ?? true,
                          mode: e.target.value as AutoCrawlSiteOverride['mode'],
                        },
                      }
                      setConfig((prev) => prev ? { ...prev, perSiteOverrides: next } : prev)
                    }}
                    className="rounded border border-[var(--border)] bg-[var(--bg2)] px-2 py-1 text-xs"
                    data-testid="crawler-auto-override-mode"
                  >
                    <option value="inherit">继承默认模式</option>
                    <option value="incremental">增量</option>
                    <option value="full">全量</option>
                  </select>
                </>
              )}
            </div>
          </div>

          <div className="rounded border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-xs text-[var(--muted)]">
            生效范围说明：
            <div>1. 全局关闭时，单站覆盖不会触发自动采集。</div>
            <div>2. 单站模式为 inherit 时继承“默认采集模式”。</div>
            <div>3. onlyEnabledSites=true 时，disabled 站点不会自动采集。</div>
            <div>4. 冲突策略默认 skip_running，避免同站并发采集。</div>
          </div>
        </div>
      )}
    </section>
  )
}
