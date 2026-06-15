/**
 * integration-credentials-config.ts — 通用化 provider 凭证解析（ADR-173 D-173-3）
 *
 * 取代单源 bangumi-config 直读 system_settings KV。逐字段解析优先级：
 *   api_credentials 行（secrets/config）→ 缺行 fallback 旧 system_settings KV（过渡期，Card D 删）
 *   → env（spec.envVar）。
 * enabled=false **压过 env 回退**（D-173-3）：对 disabled 源不注入任何凭证（等同未配置）。
 * 仅返回有值字段，缺省 default 由消费方应用（保 lib/bangumi 既有默认语义，向后兼容）。
 */

import type { Pool } from 'pg'
import { getProviderCredentialSpec } from '@resovo/types'
import type { ProviderKey, SystemSettingKey } from '@resovo/types'
import { getApiCredentialRow, normalizeRowSecrets } from '@/api/db/queries/apiCredentials'
import * as systemSettingsQueries from '@/api/db/queries/systemSettings'

export interface ResolvedCredential {
  enabled: boolean
  /** 解析后的字段值（仅含有值的字段；number 字段已强转）。 */
  fields: Record<string, string | number>
}

/**
 * 过渡期旧 KV 键映射（D-173-8）：缺行时按字段 fallback 旧 system_settings KV。
 * Card D（META-29）退役旧契约后，连同下方 fallback 分支一并删除。
 */
const LEGACY_KV_MAP: Record<string, Partial<Record<string, SystemSettingKey>>> = {
  bangumi: {
    token: 'bangumi_api_token',
    userAgent: 'bangumi_user_agent',
    timeoutMs: 'bangumi_api_timeout_ms',
  },
  // tmdb：legacy system_settings.tmdb_api_key 实为 v3 API Key → 映射新 api_key（非 Bearer），
  // 对齐 ADR-201 §凭证语义（22822「不再回填为 Bearer token」）。read_access_token 无 legacy KV 来源
  // 属预期——旧 KV 仅有 tmdb_api_key；Bearer 仅来自 api_credentials 行或 env TMDB_READ_ACCESS_TOKEN。
  // 勿擅自补 read_access_token: 'tmdb_api_key' 回填，否则违反 22822。
  tmdb: {
    api_key: 'tmdb_api_key',
  },
}

function isBlank(v: unknown): boolean {
  return v === undefined || v === null || v === ''
}

export async function loadProviderCredential(
  db: Pool,
  provider: ProviderKey,
): Promise<ResolvedCredential> {
  const spec = getProviderCredentialSpec(provider)
  if (!spec) return { enabled: true, fields: {} }

  const row = await getApiCredentialRow(db, provider)
  // D-173-3：enabled=false 压过 env 回退——不注入任何凭证
  if (row && !row.enabled) return { enabled: false, fields: {} }

  // 行内旧 secret key 兼容（ADR-201 22823）：读路径统一规范化（旧→新 in-memory），单一真源 apiCredentials
  const rowSecrets = row ? normalizeRowSecrets(provider, row.secrets) : null

  // D-173-8 过渡期：缺行才读旧 KV（一次性全量读，避免逐键多查；缺行属罕见路径）
  const legacyKv: Record<string, string> | null =
    !row && LEGACY_KV_MAP[provider] ? await systemSettingsQueries.getAllSettings(db) : null

  const fields: Record<string, string | number> = {}
  for (const field of spec.fields) {
    let raw: unknown
    if (row) {
      raw = field.secret ? rowSecrets![field.key] : row.config[field.key]
    } else if (legacyKv) {
      const kvKey = LEGACY_KV_MAP[provider]?.[field.key]
      raw = kvKey ? legacyKv[kvKey] : undefined
    }
    // 缺值 → env 回退（spec.envVar）
    if (isBlank(raw) && field.envVar) raw = process.env[field.envVar]
    if (isBlank(raw)) continue

    if (field.input === 'number') {
      const n = typeof raw === 'number' ? raw : Number(raw)
      if (Number.isFinite(n)) fields[field.key] = n
    } else {
      fields[field.key] = String(raw)
    }
  }

  return { enabled: row?.enabled ?? true, fields }
}
