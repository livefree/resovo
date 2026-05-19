'use client'

/**
 * LoginSessionsTab — 登录会话管理 Tab（CHG-SN-7-REDO-03-C）
 *
 * 范围（本卡）：会话策略配置（3 KV 字段子集）
 *   - sessionTimeoutMinutes / sessionMaxConcurrent / sessionExtendOnActivity
 *
 * 后续扩展（ADR-128 / M-SN-8+）：活跃会话列表读取 + 强制退出（独立 GET 端点 + refresh_tokens 查询）
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

const FIELD_HINT_STYLE: CSSProperties = {
  gridColumn: '2 / 3',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  marginTop: '-6px',
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

const ADVISORY_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  lineHeight: 1.6,
  padding: '8px 0',
}

interface SessionState {
  timeoutMinutes: number
  maxConcurrent: number
  extendOnActivity: boolean
}

function describeError(err: unknown): { title: string; description: string } {
  if (err instanceof ApiClientError) {
    if (err.code === 'VALIDATION_ERROR') return { title: '参数校验失败', description: err.message }
    return { title: '保存失败', description: err.message }
  }
  return { title: '保存失败', description: err instanceof Error ? err.message : '请稍后重试' }
}

export function LoginSessionsTab() {
  const toast = useToast()
  const [state, setState] = useState<SessionState | null>(null)
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
          timeoutMinutes: res.sessionTimeoutMinutes,
          maxConcurrent: res.sessionMaxConcurrent,
          extendOnActivity: res.sessionExtendOnActivity,
        })
        setDirty(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error('会话设置加载失败'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [retryKey])

  const refresh = useCallback(() => setRetryKey((k) => k + 1), [])

  const update = useCallback(<K extends keyof SessionState>(key: K, value: SessionState[K]) => {
    setState((prev) => (prev ? { ...prev, [key]: value } : prev))
    setDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (!state) return
    setSaving(true)
    try {
      await saveSiteSettings({
        sessionTimeoutMinutes: state.timeoutMinutes,
        sessionMaxConcurrent: state.maxConcurrent,
        sessionExtendOnActivity: state.extendOnActivity,
      })
      toast.push({ title: '已保存', description: '会话设置已更新', level: 'success' })
      setDirty(false)
    } catch (err: unknown) {
      const { title, description } = describeError(err)
      toast.push({ title, description, level: 'danger' })
    } finally {
      setSaving(false)
    }
  }, [state, toast])

  if (loading && !state) {
    return <div style={SECTION_STYLE} data-testid="login-sessions-tab"><LoadingState variant="skeleton" /></div>
  }

  if (error) {
    return (
      <div style={SECTION_STYLE} data-testid="login-sessions-tab">
        <ErrorState error={error} title="加载失败" onRetry={refresh} />
      </div>
    )
  }

  if (!state) return null

  return (
    <div style={SECTION_STYLE} data-testid="login-sessions-tab">
      <AdminCard
        surface="plain"
        padding="md"
        header={{ title: '会话策略', subtitle: '登录超时 / 最大并发会话数' }}
        data-testid="login-sessions-card"
      >
        <div style={FIELD_GRID_STYLE}>
          <label style={FIELD_LABEL_STYLE}>会话超时（分钟）</label>
          <AdminInput
            type="number"
            value={String(state.timeoutMinutes)}
            onChange={(e) => update('timeoutMinutes', Number(e.target.value) || 60)}
            placeholder="5-1440"
            data-testid="session-timeout-minutes"
            aria-label="会话超时（分钟）"
          />
          <div style={FIELD_HINT_STYLE}>范围 5–1440 分钟；超时后需重新登录</div>

          <label style={FIELD_LABEL_STYLE}>最大并发会话</label>
          <AdminInput
            type="number"
            value={String(state.maxConcurrent)}
            onChange={(e) => update('maxConcurrent', Number(e.target.value) || 5)}
            placeholder="1-50"
            data-testid="session-max-concurrent"
            aria-label="最大并发会话"
          />
          <div style={FIELD_HINT_STYLE}>范围 1–50；超限自动踢出最旧会话</div>

          <label style={FIELD_LABEL_STYLE}>活动续期</label>
          <AdminCheckbox
            label="活动后自动延长会话有效期"
            checked={state.extendOnActivity}
            onChange={(e) => update('extendOnActivity', e.target.checked)}
            data-testid="session-extend-on-activity"
          />
        </div>
      </AdminCard>

      <AdminCard
        surface="plain"
        padding="md"
        header={{ title: '活跃会话列表', subtitle: '待 ADR-128 / M-SN-8+ 实装' }}
        data-testid="login-sessions-card-list"
      >
        <div style={ADVISORY_STYLE}>
          计划支持：IP 地址 · User-Agent · 最后活动时间 · 强制退出单会话（M-SN-8+ ADR-128）
        </div>
      </AdminCard>

      <div style={ACTION_ROW_STYLE}>
        <span style={SYNC_RESULT_STYLE} data-testid="login-sessions-dirty-indicator">
          {dirty ? '有未保存的修改' : '无未保存修改'}
        </span>
        <span style={{ display: 'inline-flex', gap: '8px' }}>
          <AdminButton variant="default" size="sm" disabled={saving} onClick={refresh} data-testid="login-sessions-reload">
            重新加载
          </AdminButton>
          <AdminButton variant="primary" size="sm" loading={saving} disabled={!dirty} onClick={() => void handleSave()} data-testid="login-sessions-save">
            保存设置
          </AdminButton>
        </span>
      </div>
    </div>
  )
}
