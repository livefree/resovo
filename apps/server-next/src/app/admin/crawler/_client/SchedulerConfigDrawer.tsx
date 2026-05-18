'use client'

/**
 * SchedulerConfigDrawer.tsx — 调度配置编辑（CHG-SN-6-27）
 *
 * 消费：
 *   GET  /admin/crawler/auto-config  — 当前配置
 *   POST /admin/crawler/auto-config  — 提交（audit 已在 -25-RETRO 补齐）
 *
 * 范围：6 顶级字段（不含 perSiteOverrides 编辑 / 后续独立卡）
 *   globalEnabled / scheduleType=daily / dailyTime / defaultMode / onlyEnabledSites / conflictPolicy
 */

import React, { useEffect, useState, type CSSProperties } from 'react'
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
  type AutoCrawlConfig,
  type AutoCrawlMode,
  type AutoCrawlConflictPolicy,
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

const MODE_OPTIONS: readonly AdminSelectOption[] = [
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

  const updateField = <K extends keyof AutoCrawlConfig>(key: K, value: AutoCrawlConfig[K]) => {
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev))
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

          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', paddingTop: '4px' }}>
            ⓘ 单站点覆盖（perSiteOverrides）暂未在 UI 编辑；如需修改请使用 API 或后续独立面板。
          </div>

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
