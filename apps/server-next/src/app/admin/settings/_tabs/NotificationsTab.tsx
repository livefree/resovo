'use client'

/**
 * NotificationsTab — 通知设置 Tab（CHG-SN-7-REDO-03-C）
 *
 * 范围：GET/POST /admin/system/settings（5 通知字段子集）
 *   - notificationEmailEnabled / notificationEmailTo
 *   - notificationWebhookEnabled / notificationWebhookUrl / notificationWebhookSecret
 *
 * 后续扩展（ADR-129 / M-SN-8+）：事件订阅 / 多渠道 notification_channels 表
 */

import React, { useState, useEffect, useCallback, type CSSProperties } from 'react'
import {
  AdminCard,
  AdminButton,
  AdminInput,
  AdminCheckbox,
  ErrorState,
  LoadingState,
  useToast,
} from '@resovo/admin-ui'
import { getSiteSettings, saveSiteSettings } from '@/lib/system/api'
import { ApiClientError } from '@/lib/api-client'

const SECTION_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  padding: '12px 0',
}

const FIELD_GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '180px 1fr',
  gap: '12px 16px',
  alignItems: 'center',
}

const FIELD_LABEL_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

const ACTION_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  paddingTop: '8px',
}

const SYNC_RESULT_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

// CHG-SN-8-GAPS-WEBHOOK-NOT-IMPL：字段存储有效但后端 webhook 发送逻辑未实装警示
const WEBHOOK_WARN_BANNER_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  marginBottom: '12px',
  padding: '8px 12px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--state-warning-bg)',
  border: '1px solid var(--state-warning-border)',
  color: 'var(--state-warning-fg)',
  fontSize: 'var(--font-size-xs)',
  lineHeight: 1.5,
}

const ADVISORY_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  lineHeight: 1.6,
  padding: '8px 0',
}

interface NotifState {
  emailEnabled: boolean
  emailTo: string
  webhookEnabled: boolean
  webhookUrl: string
  webhookSecret: string
}

function describeError(err: unknown): { title: string; description: string } {
  if (err instanceof ApiClientError) {
    if (err.code === 'INVALID_WEBHOOK_URL') {
      return { title: 'Webhook URL 不合法', description: '必须是 http:// 或 https:// 开头的完整 URL' }
    }
    if (err.code === 'VALIDATION_ERROR') {
      return { title: '参数校验失败', description: err.message }
    }
    return { title: '保存失败', description: err.message }
  }
  return { title: '保存失败', description: err instanceof Error ? err.message : '请稍后重试' }
}

export function NotificationsTab() {
  const toast = useToast()
  const [state, setState] = useState<NotifState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [dirty, setDirty] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getSiteSettings()
      .then((res) => {
        if (cancelled) return
        setState({
          emailEnabled: res.notificationEmailEnabled,
          emailTo: res.notificationEmailTo,
          webhookEnabled: res.notificationWebhookEnabled,
          webhookUrl: res.notificationWebhookUrl,
          webhookSecret: res.notificationWebhookSecret,
        })
        setDirty(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error('通知设置加载失败'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [retryKey])

  const refresh = useCallback(() => setRetryKey((k) => k + 1), [])

  const update = useCallback(<K extends keyof NotifState>(key: K, value: NotifState[K]) => {
    setState((prev) => (prev ? { ...prev, [key]: value } : prev))
    setDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (!state) return
    setSaving(true)
    try {
      await saveSiteSettings({
        notificationEmailEnabled: state.emailEnabled,
        notificationEmailTo: state.emailTo,
        notificationWebhookEnabled: state.webhookEnabled,
        notificationWebhookUrl: state.webhookUrl,
        notificationWebhookSecret: state.webhookSecret,
      })
      toast.push({ title: '已保存', description: '通知设置已更新', level: 'success' })
      setDirty(false)
    } catch (err: unknown) {
      const { title, description } = describeError(err)
      toast.push({ title, description, level: 'danger' })
    } finally {
      setSaving(false)
    }
  }, [state, toast])

  if (loading && !state) {
    return <div style={SECTION_STYLE} data-testid="notifications-tab"><LoadingState variant="skeleton" /></div>
  }

  if (error) {
    return (
      <div style={SECTION_STYLE} data-testid="notifications-tab">
        <ErrorState error={error} title="加载失败" onRetry={refresh} />
      </div>
    )
  }

  if (!state) return null

  return (
    <div style={SECTION_STYLE} data-testid="notifications-tab">
      <AdminCard
        surface="plain"
        padding="md"
        header={{ title: '邮件通知', subtitle: '系统事件通知邮件地址' }}
        data-testid="notifications-card-email"
      >
        <div style={FIELD_GRID_STYLE}>
          <label style={FIELD_LABEL_STYLE}>启用邮件通知</label>
          <AdminCheckbox
            label="发送系统告警邮件"
            checked={state.emailEnabled}
            onChange={(e) => update('emailEnabled', e.target.checked)}
            data-testid="notif-email-enabled"
          />
          <label style={FIELD_LABEL_STYLE}>接收邮箱</label>
          <AdminInput
            value={state.emailTo}
            onChange={(e) => update('emailTo', e.target.value)}
            placeholder="admin@example.com"
            disabled={!state.emailEnabled}
            data-testid="notif-email-to"
            aria-label="接收邮箱"
          />
        </div>
      </AdminCard>

      <AdminCard
        surface="plain"
        padding="md"
        header={{ title: 'Webhook 通知', subtitle: '⚠️ 字段存储有效但触发逻辑未实装（CHG-SN-8-FUP-WEBHOOK-IMPL follow-up）' }}
        data-testid="notifications-card-webhook"
      >
        <div style={WEBHOOK_WARN_BANNER_STYLE} data-testid="webhook-not-impl-banner">
          <div>
            <strong>⚠ Webhook 触发逻辑未实装</strong>
          </div>
          <div>
            URL 和签名密钥可保存到 KV，但后端 worker 当前**不会向该 URL 发送任何 HTTP POST**。事件订阅 / HMAC 签名 / 重试策略待 ADR + 实施（GAPS.md #G-settings-webhook-impl → CHG-SN-8-FUP-WEBHOOK-IMPL）。
          </div>
        </div>
        <div style={FIELD_GRID_STYLE}>
          <label style={FIELD_LABEL_STYLE}>启用 Webhook</label>
          <AdminCheckbox
            label="推送系统事件到 Webhook 端点"
            checked={state.webhookEnabled}
            onChange={(e) => update('webhookEnabled', e.target.checked)}
            data-testid="notif-webhook-enabled"
          />
          <label style={FIELD_LABEL_STYLE}>Webhook URL</label>
          <AdminInput
            value={state.webhookUrl}
            onChange={(e) => update('webhookUrl', e.target.value)}
            placeholder="https://example.com/webhook"
            disabled={!state.webhookEnabled}
            data-testid="notif-webhook-url"
            aria-label="Webhook URL"
          />
          <label style={FIELD_LABEL_STYLE}>签名密钥</label>
          <AdminInput
            value={state.webhookSecret}
            onChange={(e) => update('webhookSecret', e.target.value)}
            placeholder="HMAC-SHA256 签名密钥（可选）"
            disabled={!state.webhookEnabled}
            data-testid="notif-webhook-secret"
            aria-label="签名密钥"
          />
        </div>
      </AdminCard>

      <AdminCard
        surface="plain"
        padding="md"
        header={{ title: '事件订阅', subtitle: '待 ADR-129 / M-SN-8+ 实装' }}
        data-testid="notifications-card-events"
      >
        <div style={ADVISORY_STYLE}>
          计划支持：采集失败 · 存储告警 · 审核待处理超阈值 · 用户投稿新增（M-SN-8+ ADR-129）
        </div>
      </AdminCard>

      <div style={ACTION_ROW_STYLE}>
        <span style={SYNC_RESULT_STYLE} data-testid="notifications-dirty-indicator">
          {dirty ? '有未保存的修改' : '无未保存修改'}
        </span>
        <span style={{ display: 'inline-flex', gap: '8px' }}>
          <AdminButton variant="default" size="sm" disabled={saving} onClick={refresh} data-testid="notifications-reload">
            重新加载
          </AdminButton>
          <AdminButton variant="primary" size="sm" loading={saving} disabled={!dirty} onClick={() => void handleSave()} data-testid="notifications-save">
            保存设置
          </AdminButton>
        </span>
      </div>
    </div>
  )
}
