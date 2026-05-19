'use client'

/**
 * ConfigTab — 高级配置 Tab（CHG-SN-6-05 / M-SN-6 第 5 张主体卡）
 *
 * 范围：消费 GET/POST /admin/system/config（v1 CHG-31 / allowlist 豁免）
 *   - configFile: JSON 字符串（crawler_sites / api_site 等字段 → 同步入 crawler_sites 表）
 *   - subscriptionUrl: 订阅 URL（必须合法 http/https）
 *
 * POST 错误码差异化：
 *   - INVALID_JSON → 提示 JSON 格式错误
 *   - INVALID_SUBSCRIPTION_URL → 提示订阅 URL 不合法
 *   - VALIDATION_ERROR → 字段级提示
 *   - 其他 → 通用 toast
 *
 * 共享原语：AdminCard / AdminButton / AdminInput / ErrorState / LoadingState / useToast
 *
 * 注意：POST 是写操作。view 层不直接调 auditSvc.write，故不触发
 * audit-log-coverage 守卫；v1 端点本身未写 admin_audit_log，留 RETRO-3 系统性补齐。
 */

import React, { useState, useEffect, useCallback, type CSSProperties } from 'react'
import {
  AdminCard,
  AdminButton,
  AdminInput,
  AdminTextarea,
  ErrorState,
  LoadingState,
  useToast,
} from '@resovo/admin-ui'
import {
  getSystemConfig,
  saveSystemConfig,
} from '@/lib/system/api'
import { ApiClientError } from '@/lib/api-client'

const SECTION_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  padding: '12px 0',
}

const FIELD_LABEL_STYLE: CSSProperties = {
  display: 'block',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const FIELD_HINT_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  marginTop: '4px',
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

function describeApiError(err: unknown): { title: string; description: string } {
  if (err instanceof ApiClientError) {
    if (err.code === 'INVALID_JSON') {
      return {
        title: '配置文件格式错误',
        description: 'JSON 解析失败，请检查语法（建议外部 JSON 验证器预校验）',
      }
    }
    if (err.code === 'INVALID_SUBSCRIPTION_URL') {
      return {
        title: '订阅 URL 不合法',
        description: '必须是 http:// 或 https:// 开头的完整 URL',
      }
    }
    if (err.code === 'VALIDATION_ERROR') {
      return {
        title: '参数校验失败',
        description: err.message,
      }
    }
    return { title: '保存失败', description: err.message }
  }
  return {
    title: '保存失败',
    description: err instanceof Error ? err.message : '请稍后重试',
  }
}

export function ConfigTab() {
  const toast = useToast()
  const [configFile, setConfigFile] = useState('')
  const [subscriptionUrl, setSubscriptionUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [dirty, setDirty] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getSystemConfig()
      .then((res) => {
        if (cancelled) return
        setConfigFile(res.configFile)
        setSubscriptionUrl(res.subscriptionUrl)
        setDirty(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error('配置加载失败'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [retryKey])

  const refresh = useCallback(() => setRetryKey((k) => k + 1), [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const result = await saveSystemConfig({ configFile, subscriptionUrl })
      // CHG-SN-7-MISC-CRAWLER-CONFIG-ORPHAN-DELETE：toast 显示 orphan delete 反馈
      const orphanSummary = result.orphanDeleted > 0
        ? ` · 清理 ${result.orphanDeleted} 个已移除（${result.orphanDeletedKeys.slice(0, 3).join(', ')}${result.orphanDeletedKeys.length > 3 ? '…' : ''}）`
        : ''
      toast.push({
        title: '已保存',
        description: `crawler_sites 同步：成功 ${result.synced} 个 · 跳过 ${result.skipped} 个${orphanSummary}`,
        level: 'success',
      })
      setDirty(false)
    } catch (err: unknown) {
      const { title, description } = describeApiError(err)
      toast.push({ title, description, level: 'danger' })
    } finally {
      setSaving(false)
    }
  }, [configFile, subscriptionUrl, toast])

  if (loading && !configFile && !subscriptionUrl) {
    return (
      <div style={SECTION_STYLE} data-testid="config-tab">
        <LoadingState variant="skeleton" />
      </div>
    )
  }

  if (error) {
    return (
      <div style={SECTION_STYLE} data-testid="config-tab">
        <ErrorState error={error} title="加载失败" onRetry={refresh} />
      </div>
    )
  }

  return (
    <div style={SECTION_STYLE} data-testid="config-tab">
      <AdminCard
        surface="plain"
        padding="md"
        header={{
          title: '配置文件',
          subtitle: 'JSON 格式 / crawler_sites + api_site 字段同步至 crawler_sites 表',
        }}
        data-testid="config-card-file"
      >
        <label style={FIELD_LABEL_STYLE} htmlFor="config-file-textarea">
          configFile (JSON)
        </label>
        <AdminTextarea
          id="config-file-textarea"
          value={configFile}
          onChange={(e) => { setConfigFile(e.target.value); setDirty(true) }}
          rows={14}
          monospace
          spellCheck={false}
          data-testid="config-file-textarea"
          aria-label="configFile JSON"
        />
        <div style={FIELD_HINT_STYLE}>
          字符数：{configFile.length.toLocaleString()} · 提交后由后端 JSON.parse 校验
        </div>
      </AdminCard>

      <AdminCard
        surface="plain"
        padding="md"
        header={{
          title: '订阅 URL',
          subtitle: '可选；http:// 或 https:// 起始；用于配置远端同步',
        }}
        data-testid="config-card-subscription"
      >
        <label style={FIELD_LABEL_STYLE} htmlFor="config-subscription-input">
          subscriptionUrl
        </label>
        <AdminInput
          value={subscriptionUrl}
          onChange={(e) => { setSubscriptionUrl(e.target.value); setDirty(true) }}
          placeholder="https://example.com/config.json"
          data-testid="config-subscription-input"
          aria-label="subscriptionUrl"
        />
      </AdminCard>

      <div style={ACTION_ROW_STYLE}>
        <span style={SYNC_RESULT_STYLE} data-testid="config-dirty-indicator">
          {dirty ? '有未保存的修改' : '无未保存修改'}
        </span>
        <span style={{ display: 'inline-flex', gap: '8px' }}>
          <AdminButton
            variant="default"
            size="sm"
            disabled={saving}
            onClick={refresh}
            data-testid="config-reload"
          >
            重新加载
          </AdminButton>
          <AdminButton
            variant="primary"
            size="sm"
            loading={saving}
            disabled={!dirty}
            onClick={() => void handleSave()}
            data-testid="config-save"
          >
            保存配置
          </AdminButton>
        </span>
      </div>
    </div>
  )
}
