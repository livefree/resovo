/**
 * tmdb-config.ts — TMDb 凭证解析薄封装（ADR-201 §凭证语义，对齐 bangumi-config.ts D-173-3）
 *
 * loadTmdbClientConfig 委托通用 loadProviderCredential('tmdb')：
 *   api_credentials 行优先 → 缺行 fallback 旧 system_settings KV（tmdb_api_key→api_key）→ env。
 * 映射为 TmdbClientConfig（仅注入有值字段；Bearer read_access_token 首选 + api_key v3 兼容并存，
 *   实际认证方式由 lib/tmdb.resolveTmdbAuthMethod 在消费点派生）。
 */

import type { Pool } from 'pg'
import type { TmdbClientConfig } from '@/api/lib/tmdb'
import { loadProviderCredential } from './integration-credentials-config'

export async function loadTmdbClientConfig(db: Pool): Promise<TmdbClientConfig> {
  const resolved = await loadProviderCredential(db, 'tmdb')
  const cfg: TmdbClientConfig = {}
  const readAccessToken = resolved.fields.read_access_token
  if (typeof readAccessToken === 'string' && readAccessToken) cfg.readAccessToken = readAccessToken
  const apiKey = resolved.fields.api_key
  if (typeof apiKey === 'string' && apiKey) cfg.apiKey = apiKey
  const baseUrl = resolved.fields.baseUrl
  if (typeof baseUrl === 'string' && baseUrl) cfg.baseUrl = baseUrl
  const language = resolved.fields.language
  if (typeof language === 'string' && language) cfg.language = language
  return cfg
}
