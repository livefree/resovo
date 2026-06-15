/**
 * IntegrationCredentialsService.ts — API 凭证统一管理服务编排（ADR-173 D-173-4/5）
 *
 * list：注册表 × api_credentials 行 → 遮罩视图 + 测试状态（GET）。
 * save：占位跳过（secret 字段遮罩回提）+ JSONB 合并 upsert + 审计 redact（PUT）。
 * test：三态取值（候选→已存→env）+ 草稿不污染已存状态 + 审计不落候选 secret（POST）。
 *
 * 遮罩/redact 真源 = 注册表 secret flag（D-173-4，非 key 名正则）。
 */

import type { Pool } from 'pg'
import { PROVIDER_CREDENTIAL_SPECS, getProviderCredentialSpec } from '@resovo/types'
import type { ProviderKey, ProviderCredentialSpec } from '@resovo/types'
import { maskSecret, isMaskedPlaceholder } from '@/api/lib/secretRedaction'
import {
  listApiCredentialRows,
  getApiCredentialRow,
  upsertApiCredential,
  updateApiCredentialTestStatus,
  normalizeRowSecrets,
  LEGACY_ROW_SECRET_KEYS,
  type ApiCredentialRow,
} from '@/api/db/queries/apiCredentials'
import { loadProviderCredential, type ResolvedCredential } from './integration-credentials-config'
import { testProviderCredential } from './integration-credential-testers'
import { AuditLogService } from './AuditLogService'

/** GET 单源视图（UI 与 spec 元数据组合渲染；响应窄化形态，server-next 镜像）。 */
export interface IntegrationCredentialView {
  provider: ProviderKey
  label: string
  /** 逐字段当前值：secret 字段遮罩（••••后4位 / 空），非 secret 明文 */
  values: Record<string, string>
  /** 是否已配置（任一 secret 字段在 DB 行有值） */
  configured: boolean
  enabled: boolean
  lastTestedAt: string | null
  lastTestOk: boolean | null
  lastTestLatencyMs: number | null
  lastTestError: string | null
}

export interface CredentialTestView {
  ok: boolean
  latencyMs: number
  error?: string
  authStatus?: 'valid' | 'invalid' | 'not_required'
  testedAt: string
}

/** 未知 provider（非凭证可配源）→ 路由映射 404。 */
export class UnknownCredentialProviderError extends Error {
  constructor(readonly provider: string) {
    super(`unknown credential provider: ${provider}`)
    this.name = 'UnknownCredentialProviderError'
  }
}

function isNumberField(spec: ProviderCredentialSpec, key: string): boolean {
  return spec.fields.find((f) => f.key === key)?.input === 'number'
}

export class IntegrationCredentialsService {
  private readonly auditSvc: AuditLogService
  constructor(private readonly db: Pool) {
    this.auditSvc = new AuditLogService(db)
  }

  /** GET /admin/integrations/credentials：注册表驱动遮罩视图 + 测试状态。 */
  async listForAdmin(): Promise<IntegrationCredentialView[]> {
    const rows = await listApiCredentialRows(this.db)
    const byProvider = new Map<string, ApiCredentialRow>(rows.map((r) => [r.provider, r]))
    return PROVIDER_CREDENTIAL_SPECS.map((spec) => this.toView(spec, byProvider.get(spec.provider) ?? null))
  }

  private toView(spec: ProviderCredentialSpec, row: ApiCredentialRow | null): IntegrationCredentialView {
    // 行内旧 secret key 兼容（ADR-201 22823）：读路径规范化（旧 token→read_access_token），
    // 使未迁移旧行 configured/遮罩值正确显示（否则误显示「未配置」+ auth_method 误判）
    const secrets = row ? normalizeRowSecrets(spec.provider, row.secrets) : null
    const values: Record<string, string> = {}
    let configured = false
    for (const field of spec.fields) {
      const raw = row ? (field.secret ? secrets![field.key] : row.config[field.key]) : undefined
      if (field.secret) {
        const s = typeof raw === 'string' ? raw : ''
        values[field.key] = maskSecret(s)
        if (s.length > 0) configured = true
      } else {
        values[field.key] = raw != null ? String(raw) : ''
      }
    }
    return {
      provider: spec.provider,
      label: spec.label,
      values,
      configured,
      enabled: row?.enabled ?? true,
      lastTestedAt: row?.lastTestedAt ?? null,
      lastTestOk: row?.lastTestOk ?? null,
      lastTestLatencyMs: row?.lastTestLatencyMs ?? null,
      lastTestError: row?.lastTestError ?? null,
    }
  }

  /** PUT /admin/integrations/credentials/:provider：占位跳过 + JSONB 合并 + 审计。 */
  async save(
    provider: ProviderKey,
    body: Record<string, unknown>,
    actorId: string,
    requestId: string,
  ): Promise<void> {
    const spec = getProviderCredentialSpec(provider)
    if (!spec) throw new UnknownCredentialProviderError(provider)

    const secrets: Record<string, unknown> = {}
    const config: Record<string, unknown> = {}
    for (const field of spec.fields) {
      if (!(field.key in body)) continue
      const val = body[field.key]
      if (field.secret) {
        // 占位回提 → 跳过（保留原值，防保存即清空，D-173-4）；'' → 主动清空；明文 → 覆盖
        if (typeof val === 'string' && isMaskedPlaceholder(val)) continue
        secrets[field.key] = typeof val === 'string' ? val : ''
      } else if (field.input === 'number') {
        const n = Number(val)
        if (Number.isFinite(n)) config[field.key] = n
      } else {
        config[field.key] = String(val ?? '')
      }
    }
    const enabled = typeof body.enabled === 'boolean' ? body.enabled : undefined

    // 审计 before/after（secret 字段以注册表 secret flag redact 为 <set>/<cleared>，D-173-4）
    const before = await getApiCredentialRow(this.db, provider)
    const beforeJsonb = this.redactAuditState(spec, before, Object.keys({ ...secrets, ...config }))

    // 旧 secret key 清理（ADR-201 22823「写入只走新字段」）：仅当本次**提交了对应新 key**（新值或清空）
    // → 删 DB 残留旧 key（凭证切换到新字段，杜绝清空后旧 token 被 loader fallback 残留读取）。
    // 未提交新 key（如只改 baseUrl）→ secrets 不含该字段、dropSecretKeys 不含旧 key，save **完全不触碰
    // secrets**——旧 token 由读路径 normalizeRowSecrets 兜底。绝不写回 before 快照值，从而保留 upsert
    // merge 的天然并发安全：A 改无关字段不会用陈旧快照覆盖 B 并发写入的较新凭证。
    const dropSecretKeys: string[] = []
    for (const [newKey, oldKey] of Object.entries(LEGACY_ROW_SECRET_KEYS[provider] ?? {})) {
      if (oldKey && newKey in secrets) dropSecretKeys.push(oldKey)
    }

    await upsertApiCredential(this.db, { provider, secrets, config, enabled, dropSecretKeys, updatedBy: actorId })

    const afterJsonb: Record<string, unknown> = { provider }
    for (const field of spec.fields) {
      if (field.secret && field.key in secrets) {
        afterJsonb[field.key] = (secrets[field.key] as string).length > 0 ? '<set>' : '<cleared>'
      } else if (!field.secret && field.key in config) {
        afterJsonb[field.key] = config[field.key]
      }
    }
    if (enabled !== undefined) afterJsonb.enabled = enabled

    this.auditSvc.write({
      actorId,
      actionType: 'integration.credential_update',
      targetKind: 'system',
      targetId: null,
      beforeJsonb,
      afterJsonb,
      requestId,
    })
  }

  /** 审计 before 状态 redact（仅本次改动的字段；secret → <set>/<cleared>）。 */
  private redactAuditState(
    spec: ProviderCredentialSpec,
    row: ApiCredentialRow | null,
    changedKeys: string[],
  ): Record<string, unknown> {
    const secrets = row ? normalizeRowSecrets(spec.provider, row.secrets) : null
    const out: Record<string, unknown> = { provider: spec.provider }
    for (const field of spec.fields) {
      if (!changedKeys.includes(field.key)) continue
      const raw = row ? (field.secret ? secrets![field.key] : row.config[field.key]) : undefined
      if (field.secret) {
        out[field.key] = typeof raw === 'string' && raw.length > 0 ? '<set>' : '<cleared>'
      } else {
        out[field.key] = raw ?? null
      }
    }
    return out
  }

  /** POST /admin/integrations/credentials/:provider/test：三态取值 + 草稿不污染 + 审计不落候选 secret。 */
  async test(
    provider: ProviderKey,
    body: Record<string, unknown>,
    actorId: string,
    requestId: string,
  ): Promise<CredentialTestView> {
    const spec = getProviderCredentialSpec(provider)
    if (!spec) throw new UnknownCredentialProviderError(provider)

    const draft = body.draft === true
    const base = await loadProviderCredential(this.db, provider) // 已存值（→env 回退）
    let resolved: ResolvedCredential = base
    if (draft) {
      // 候选值（传入且非遮罩占位 / 非空）覆盖已存；遮罩占位或空 → 保留已存/env（D-173-5）
      const fields = { ...base.fields }
      for (const field of spec.fields) {
        if (!(field.key in body)) continue
        const val = body[field.key]
        if (field.secret && typeof val === 'string' && isMaskedPlaceholder(val)) continue
        if (val === '' || val == null) continue
        fields[field.key] = isNumberField(spec, field.key) ? Number(val) : String(val)
      }
      resolved = { enabled: base.enabled, fields }
    }

    const result = await testProviderCredential(provider, resolved)
    const testedAt = new Date().toISOString()

    // D-173-5：仅「已保存配置」测试持久化行级状态；草稿测试不写
    if (!draft) {
      await updateApiCredentialTestStatus(this.db, {
        provider,
        ok: result.ok,
        latencyMs: result.latencyMs,
        error: result.error ?? null,
      })
    }

    // 审计：不落候选 secret（仅 provider/draft/结果元数据）
    this.auditSvc.write({
      actorId,
      actionType: 'integration.credential_test',
      targetKind: 'system',
      targetId: null,
      beforeJsonb: null,
      afterJsonb: { provider, draft, ok: result.ok, authStatus: result.authStatus ?? null },
      requestId,
    })

    return { ...result, testedAt }
  }
}
