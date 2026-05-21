'use client'

/**
 * SchedulerConfigDrawer.tsx — 调度配置编辑（CHG-SN-6-27 / CHG-SN-7-MISC-PERSITE）
 *
 * 消费：
 *   GET  /admin/crawler/auto-config  — 当前配置
 *   POST /admin/crawler/auto-config  — 提交（audit 已在 -25-RETRO 补齐）
 *   GET  /admin/crawler/sites        — 站点列表（perSiteOverrides 选择器用）
 *
 * 范围：6 顶级字段 + perSiteOverrides 每站点覆盖编辑（enabled / mode）
 */

import React, { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  Drawer,
  AdminButton,
  AdminInput,
  AdminSelect,
  AdminCheckbox,
  ErrorState,
  LoadingState,
  useToast,
  type AdminSelectOption,
} from '@resovo/admin-ui'
import {
  getAutoCrawlConfig,
  setAutoCrawlConfig,
  listCrawlerSites,
  type AutoCrawlConfig,
  type AutoCrawlMode,
  type AutoCrawlConflictPolicy,
  type AutoCrawlSiteOverride,
  type CrawlerSite,
} from '@/lib/crawler/api'
import { ApiClientError } from '@/lib/api-client'

const BODY_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
  padding: '4px',
}

const FIELD_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
}

const LABEL_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

const ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
}

const FOOTER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  padding: '12px 0 4px',
  borderTop: '1px solid var(--border-subtle)',
  marginTop: '8px',
}

const SECTION_DIVIDER_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontWeight: 600,
  color: 'var(--fg-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  paddingTop: '4px',
  borderTop: '1px solid var(--border-subtle)',
}

const OVERRIDE_LIST_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  maxHeight: '220px',
  overflowY: 'auto',
}

const OVERRIDE_ROW_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto auto auto',
  alignItems: 'center',
  gap: '8px',
  padding: '4px 2px',
}

const SITE_NAME_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const OVERRIDE_EMPTY_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  padding: '8px 2px',
}

const MODE_OPTIONS: readonly AdminSelectOption[] = [
  { value: 'incremental', label: '增量' },
  { value: 'full',        label: '全量' },
]

const SITE_MODE_OPTIONS: readonly AdminSelectOption[] = [
  { value: 'inherit',     label: '继承全局' },
  { value: 'incremental', label: '增量' },
  { value: 'full',        label: '全量' },
]

const CONFLICT_OPTIONS: readonly AdminSelectOption[] = [
  { value: 'skip_running',         label: '跳过运行中（safe）' },
  { value: 'queue_after_running',  label: '排队等待（throughput）' },
]

export interface SchedulerConfigDrawerProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly onSaved?: () => void
}

export function SchedulerConfigDrawer({ open, onClose, onSaved }: SchedulerConfigDrawerProps) {
  const toast = useToast()
  const [config, setConfig] = useState<AutoCrawlConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [saving, setSaving] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [sites, setSites] = useState<readonly CrawlerSite[]>([])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setConfig(null)
    getAutoCrawlConfig()
      .then((c) => { if (!cancelled) setConfig(c) })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error('配置加载失败'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, retryKey])

  useEffect(() => {
    if (!open) return
    listCrawlerSites()
      .then((data) => setSites(data))
      .catch(() => { /* 非关键，选择器列表为空时降级为手动输入 */ })
  }, [open])

  const updateField = <K extends keyof AutoCrawlConfig>(key: K, value: AutoCrawlConfig[K]) => {
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const removeSiteOverride = (siteKey: string) => {
    if (!config) return
    const next = { ...config.perSiteOverrides }
    delete next[siteKey]
    updateField('perSiteOverrides', next)
  }

  const updateSiteOverride = (siteKey: string, patch: Partial<AutoCrawlSiteOverride>) => {
    if (!config) return
    const current = config.perSiteOverrides[siteKey] ?? { enabled: true, mode: 'inherit' as const }
    updateField('perSiteOverrides', {
      ...config.perSiteOverrides,
      [siteKey]: { ...current, ...patch },
    })
  }

  const handleAddSite = (siteKey: string | null) => {
    if (!siteKey || !config) return
    if (siteKey in config.perSiteOverrides) return
    updateField('perSiteOverrides', {
      ...config.perSiteOverrides,
      [siteKey]: { enabled: true, mode: 'inherit' },
    })
  }

  const handleSubmit = async () => {
    if (!config) return
    setSaving(true)
    try {
      await setAutoCrawlConfig(config)
      toast.push({ title: '调度配置已更新', description: `定时 ${config.dailyTime} · 模式 ${config.defaultMode}`, level: 'success' })
      onSaved?.()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : (err instanceof Error ? err.message : '提交失败')
      toast.push({ title: '保存失败', description: msg, level: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  const refresh = () => setRetryKey((k) => k + 1)

  const siteNameMap = useMemo<Record<string, string>>(
    () => Object.fromEntries(sites.map((s) => [s.key, s.displayName ?? s.name])),
    [sites],
  )

  const overrideEntries = config ? Object.entries(config.perSiteOverrides) : []
  const overrideKeys = overrideEntries.map(([k]) => k)
  const addableSites = sites.filter((s) => !overrideKeys.includes(s.key))

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="right"
      width={480}
      title="调度配置"
      data-testid="scheduler-config-drawer"
    >
      {loading && !config ? (
        <LoadingState variant="skeleton" />
      ) : error ? (
        <ErrorState error={error} title="加载失败" onRetry={refresh} />
      ) : config ? (
        <div style={BODY_STYLE} data-scheduler-config-form>
          <div style={ROW_STYLE}>
            <AdminCheckbox
              checked={config.globalEnabled}
              onChange={(e) => updateField('globalEnabled', e.target.checked)}
              data-testid="scheduler-globalEnabled"
            />
            <span style={{ fontSize: 'var(--font-size-sm)' }}>全局开启自动调度</span>
          </div>

          <div style={FIELD_STYLE}>
            <span style={LABEL_STYLE}>每日触发时间（HH:MM）</span>
            <AdminInput
              value={config.dailyTime}
              onChange={(e) => updateField('dailyTime', e.target.value)}
              placeholder="HH:MM"
              pattern="^\d{2}:\d{2}$"
              data-testid="scheduler-dailyTime"
              aria-label="每日触发时间"
            />
          </div>

          <div style={FIELD_STYLE}>
            <span style={LABEL_STYLE}>默认采集模式</span>
            <AdminSelect
              options={MODE_OPTIONS}
              value={config.defaultMode}
              onChange={(v) => updateField('defaultMode', (v ?? 'incremental') as AutoCrawlMode)}
              data-testid="scheduler-defaultMode"
              aria-label="默认采集模式"
            />
          </div>

          <div style={ROW_STYLE}>
            <AdminCheckbox
              checked={config.onlyEnabledSites}
              onChange={(e) => updateField('onlyEnabledSites', e.target.checked)}
              data-testid="scheduler-onlyEnabledSites"
            />
            <span style={{ fontSize: 'var(--font-size-sm)' }}>仅采集已启用站点（disabled 站点跳过）</span>
          </div>

          <div style={FIELD_STYLE}>
            <span style={LABEL_STYLE}>冲突策略（运行中再次触发时）</span>
            <AdminSelect
              options={CONFLICT_OPTIONS}
              value={config.conflictPolicy}
              onChange={(v) => updateField('conflictPolicy', (v ?? 'skip_running') as AutoCrawlConflictPolicy)}
              data-testid="scheduler-conflictPolicy"
              aria-label="冲突策略"
            />
          </div>

          {/* ── 站点调度覆盖 ──────────────────────────────────── */}
          <div style={SECTION_DIVIDER_STYLE}>
            站点调度覆盖（{overrideEntries.length} 已配置）
          </div>

          {overrideEntries.length > 0 ? (
            <div style={OVERRIDE_LIST_STYLE} data-testid="scheduler-overrides-list">
              {overrideEntries.map(([siteKey, override]) => (
                <div key={siteKey} style={OVERRIDE_ROW_STYLE} data-testid={`override-row-${siteKey}`}>
                  <span style={SITE_NAME_STYLE} title={siteKey}>
                    {siteNameMap[siteKey] ?? siteKey}
                  </span>
                  <AdminCheckbox
                    checked={override.enabled}
                    onChange={(e) => updateSiteOverride(siteKey, { enabled: e.target.checked })}
                    aria-label={`${siteKey} 启用采集`}
                    data-testid={`override-enabled-${siteKey}`}
                  />
                  <AdminSelect
                    options={SITE_MODE_OPTIONS}
                    value={override.mode}
                    onChange={(v) => updateSiteOverride(siteKey, { mode: (v ?? 'inherit') as 'inherit' | AutoCrawlMode })}
                    size="sm"
                    aria-label={`${siteKey} 采集模式`}
                    data-testid={`override-mode-${siteKey}`}
                  />
                  <AdminButton
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSiteOverride(siteKey)}
                    aria-label={`移除 ${siteKey} 覆盖`}
                    data-testid={`override-remove-${siteKey}`}
                  >
                    ×
                  </AdminButton>
                </div>
              ))}
            </div>
          ) : (
            <div style={OVERRIDE_EMPTY_STYLE} data-testid="scheduler-overrides-empty">
              暂无站点覆盖，所有站点使用全局配置
            </div>
          )}

          {addableSites.length > 0 && (
            <AdminSelect
              options={addableSites.map((s) => ({ value: s.key, label: s.displayName ?? s.name }))}
              value={null}
              onChange={(v) => handleAddSite(v)}
              placeholder="添加站点覆盖..."
              size="sm"
              searchable
              data-testid="scheduler-add-site"
              aria-label="添加站点调度覆盖"
            />
          )}

          <div style={FOOTER_STYLE}>
            <AdminButton variant="ghost" onClick={onClose} disabled={saving} data-testid="scheduler-cancel">
              取消
            </AdminButton>
            <AdminButton
              variant="primary"
              onClick={() => void handleSubmit()}
              loading={saving}
              disabled={saving}
              data-testid="scheduler-submit"
            >
              保存
            </AdminButton>
          </div>
        </div>
      ) : null}
    </Drawer>
  )
}
