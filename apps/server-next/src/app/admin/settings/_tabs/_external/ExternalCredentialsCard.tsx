'use client'

/**
 * ExternalCredentialsCard — 外部数据源凭证统一管理（ADR-173 D-173-10）
 *
 * 按 @resovo/types PROVIDER_CREDENTIAL_SPECS 注册表驱动渲染多源凭证卡（bangumi / tmdb / 未来源），
 * 取代 SettingsTab 原硬编码 bangumi 卡。每源：字段（spec 生成，secret 字段 password + 显隐）+
 * 保存 + 测试连接（测待保存输入值 draft=true）+ 状态行（已配置 / 上次测试 / enabled 开关）。
 * 自管取数（lib/integrations/api），与通用站点设置保存流解耦。
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
import {
  PROVIDER_CREDENTIAL_SPECS,
  type CredentialFieldSpec,
  type ProviderCredentialSpec,
} from '@resovo/types'
import {
  getIntegrationCredentials,
  saveIntegrationCredential,
  testIntegrationCredential,
  type IntegrationCredentialView,
  type CredentialPatch,
  type CredentialTestResult,
} from '@/lib/integrations/api'

const SECTION_STYLE: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '16px' }
const FIELD_GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '180px 1fr',
  gap: '12px 16px',
  alignItems: 'center',
}
const FIELD_LABEL_STYLE: CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }
const HINT_STYLE: CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', lineHeight: 1.6 }
const ACTION_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '8px',
  paddingTop: '10px',
}

/** 构建提交 patch：number 字段转数字，其余字符串；含 enabled。 */
function buildPatch(spec: ProviderCredentialSpec, values: Record<string, string>, enabled: boolean): CredentialPatch {
  const patch: CredentialPatch = { enabled }
  for (const field of spec.fields) {
    const raw = values[field.key] ?? ''
    patch[field.key] = field.input === 'number' ? Number(raw) || 0 : raw
  }
  return patch
}

function authStatusLabel(s: CredentialTestResult['authStatus']): string {
  if (s === 'valid') return '凭证有效'
  if (s === 'invalid') return '凭证无效'
  if (s === 'not_required') return '连通正常（无需凭证）'
  return ''
}

/**
 * tmdb 专属：从已保存遮罩 values 派生当前生效认证方式（Bearer 优先，ADR-201 22811）。
 * read_access_token / api_key 遮罩值非空即代表该字段已配置。
 */
function tmdbAuthMethodLabel(values: Record<string, string>): string {
  if (values.read_access_token) return 'Bearer Read Access Token（首选）'
  if (values.api_key) return 'API Key（v3 兼容）'
  return '未配置'
}

interface ProviderCardProps {
  spec: ProviderCredentialSpec
  view: IntegrationCredentialView
  /** 保存成功后回调父级刷新（重取遮罩值 + configured/状态，并重挂本卡，防 stale 误导态） */
  onSaved: () => Promise<void>
}

function ProviderCredentialCard({ spec, view, onSaved }: ProviderCardProps) {
  const toast = useToast()
  const initValues = useCallback((): Record<string, string> => {
    const v: Record<string, string> = {}
    for (const field of spec.fields) v[field.key] = view.values[field.key] ?? ''
    return v
  }, [spec, view])

  const [values, setValues] = useState<Record<string, string>>(initValues)
  const [enabled, setEnabled] = useState(view.enabled)
  const [shown, setShown] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<CredentialTestResult | null>(null)

  const setField = (key: string, val: string) => setValues((prev) => ({ ...prev, [key]: val }))

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await saveIntegrationCredential(spec.provider, buildPatch(spec, values, enabled))
      toast.push({ title: '已保存', description: `${spec.label} 凭证已更新`, level: 'success' })
      setTestResult(null) // 清除上次「未保存输入」测试结果，避免与已保存态混淆
      // 刷新父级：重取遮罩值 + configured/状态行，并以 nonce key 重挂本卡（输入框回显遮罩值，
      // 修「保存成功却仍显未配置 / 残留明文 token」的 stale 误导态，Codex stop-time review）
      await onSaved()
    } catch (err) {
      toast.push({ title: '保存失败', description: err instanceof Error ? err.message : '请稍后重试', level: 'danger' })
    } finally {
      setSaving(false)
    }
  }, [spec, values, enabled, toast, onSaved])

  const handleTest = useCallback(async () => {
    setTesting(true)
    setTestResult(null)
    try {
      // 测「待保存的输入值」（draft=true）；遮罩占位/空由后端回退已存值
      const result = await testIntegrationCredential(spec.provider, { ...buildPatch(spec, values, enabled), draft: true })
      setTestResult(result)
    } catch (err) {
      toast.push({ title: '测试失败', description: err instanceof Error ? err.message : '请稍后重试', level: 'danger' })
    } finally {
      setTesting(false)
    }
  }, [spec, values, enabled, toast])

  return (
    <AdminCard
      surface="plain"
      padding="md"
      header={{ title: spec.label, subtitle: `${spec.provider} API 凭证（添加 / 保存 / 测试连接）` }}
      data-testid={`integration-card-${spec.provider}`}
    >
      <div style={FIELD_GRID_STYLE}>
        {spec.fields.map((field: CredentialFieldSpec) => (
          <React.Fragment key={field.key}>
            <label style={FIELD_LABEL_STYLE}>{field.label}</label>
            {field.secret ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <AdminInput
                  type={shown[field.key] ? 'text' : 'password'}
                  value={values[field.key] ?? ''}
                  onChange={(e) => setField(field.key, e.target.value)}
                  placeholder={field.placeholder ?? ''}
                  data-testid={`integration-${spec.provider}-${field.key}`}
                  aria-label={`${spec.label} ${field.label}`}
                />
                <AdminButton
                  size="sm"
                  variant="ghost"
                  onClick={() => setShown((p) => ({ ...p, [field.key]: !p[field.key] }))}
                  data-testid={`integration-${spec.provider}-${field.key}-toggle`}
                >
                  {shown[field.key] ? '隐藏' : '显示'}
                </AdminButton>
              </div>
            ) : (
              <AdminInput
                type={field.input === 'number' ? 'number' : 'text'}
                value={values[field.key] ?? ''}
                onChange={(e) => setField(field.key, e.target.value)}
                placeholder={field.placeholder ?? (field.default != null ? String(field.default) : '')}
                data-testid={`integration-${spec.provider}-${field.key}`}
                aria-label={`${spec.label} ${field.label}`}
              />
            )}
          </React.Fragment>
        ))}
        <label style={FIELD_LABEL_STYLE}>启用</label>
        <AdminCheckbox
          label="启用此数据源（关闭后不注入凭证）"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          data-testid={`integration-${spec.provider}-enabled`}
        />
      </div>

      {/* 状态行 */}
      <div style={{ ...HINT_STYLE, marginTop: '10px' }} data-testid={`integration-${spec.provider}-status`}>
        <span style={{ color: view.configured ? 'var(--state-success-fg)' : 'var(--fg-muted)' }}>
          {view.configured ? '✅ 已配置' : '未配置'}
        </span>
        {spec.provider === 'tmdb' && (
          <span style={{ marginLeft: '12px' }} data-testid="integration-tmdb-auth-method">
            认证方式：{tmdbAuthMethodLabel(view.values)}
          </span>
        )}
        {view.lastTestedAt && (
          <span style={{ marginLeft: '12px' }}>
            上次测试：{new Date(view.lastTestedAt).toLocaleString()} ·{' '}
            <span style={{ color: view.lastTestOk ? 'var(--state-success-fg)' : 'var(--state-danger-fg)' }}>
              {view.lastTestOk ? '成功' : '失败'}
            </span>
            {view.lastTestLatencyMs != null && `（${view.lastTestLatencyMs}ms）`}
            {!view.lastTestOk && view.lastTestError && ` · ${view.lastTestError}`}
          </span>
        )}
      </div>

      {/* 测试结果（本次未保存输入测试） */}
      {testResult && (
        <div
          style={{
            ...HINT_STYLE,
            marginTop: '6px',
            color: testResult.ok ? 'var(--state-success-fg)' : 'var(--state-danger-fg)',
          }}
          data-testid={`integration-${spec.provider}-test-result`}
        >
          {testResult.ok ? '✅ 连接测试通过' : '❌ 连接测试失败'}
          {testResult.authStatus && ` · ${authStatusLabel(testResult.authStatus)}`}
          {` · ${testResult.latencyMs}ms`}
          {!testResult.ok && testResult.error && ` · ${testResult.error}`}
          <span style={{ marginLeft: '8px', color: 'var(--fg-muted)' }}>（未保存输入测试）</span>
        </div>
      )}

      <div style={ACTION_ROW_STYLE}>
        <AdminButton
          variant="default"
          size="sm"
          loading={testing}
          onClick={() => void handleTest()}
          data-testid={`integration-${spec.provider}-test`}
        >
          测试连接
        </AdminButton>
        <AdminButton
          variant="primary"
          size="sm"
          loading={saving}
          onClick={() => void handleSave()}
          data-testid={`integration-${spec.provider}-save`}
        >
          保存
        </AdminButton>
      </div>
    </AdminCard>
  )
}

export function ExternalCredentialsCard() {
  const toast = useToast()
  const [views, setViews] = useState<IntegrationCredentialView[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  // 每源「已保存」次数：保存后 +1 → 作为该卡 remount key，强制以最新遮罩值/状态重挂（仅重挂被保存卡，
  // 不影响其它源的未保存编辑）
  const [savedNonce, setSavedNonce] = useState<Record<string, number>>({})

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getIntegrationCredentials()
      .then((res) => { if (!cancelled) setViews(res) })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err : new Error('凭证加载失败')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [retryKey])

  // 保存成功后刷新：先重取（更新 views）再 bump nonce（同批 → 重挂卡读到最新遮罩值/状态）。
  const handleSaved = useCallback(async (provider: string) => {
    try {
      const fresh = await getIntegrationCredentials()
      setViews(fresh)
    } catch {
      // 刷新失败不回滚已成功的保存；保留旧视图（下次进入页面自然刷新）+ 轻提示
      toast.push({ title: '状态刷新失败', description: '凭证已保存，但列表状态未能刷新', level: 'warn' })
    }
    setSavedNonce((prev) => ({ ...prev, [provider]: (prev[provider] ?? 0) + 1 }))
  }, [toast])

  if (loading && !views) return <LoadingState variant="skeleton" />
  if (error) return <ErrorState error={error} title="加载失败" onRetry={() => setRetryKey((k) => k + 1)} />
  if (!views) return null

  const byProvider = new Map(views.map((v) => [v.provider, v]))
  return (
    <div style={SECTION_STYLE} data-testid="external-credentials">
      {PROVIDER_CREDENTIAL_SPECS.map((spec) => {
        const view = byProvider.get(spec.provider)
        if (!view) return null
        return (
          <ProviderCredentialCard
            key={`${spec.provider}-${savedNonce[spec.provider] ?? 0}`}
            spec={spec}
            view={view}
            onSaved={() => handleSaved(spec.provider)}
          />
        )
      })}
    </div>
  )
}
