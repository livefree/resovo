/**
 * bangumi-config.ts — Bangumi 凭证解析薄封装（ADR-173 D-173-3，原 ADR-168 D-168-5 升级）
 *
 * loadBangumiClientConfig 现委托通用 loadProviderCredential('bangumi')：
 *   api_credentials 行优先 → 缺行 fallback 旧 system_settings KV → env（向后兼容）。
 * 映射为 BangumiClientConfig（仅注入有值字段，缺省由 lib/bangumi 回退默认 UA/timeout）。
 * 签名不变 → BangumiService（60s 缓存）/ BangumiResourceAdapter 共享消费零改动。
 */

import type { Pool } from 'pg'
import type { BangumiClientConfig } from '@/api/lib/bangumi'
import { loadProviderCredential } from './integration-credentials-config'

export async function loadBangumiClientConfig(db: Pool): Promise<BangumiClientConfig> {
  const resolved = await loadProviderCredential(db, 'bangumi')
  const cfg: BangumiClientConfig = {}
  const token = resolved.fields.token
  if (typeof token === 'string' && token) cfg.token = token
  const userAgent = resolved.fields.userAgent
  if (typeof userAgent === 'string' && userAgent) cfg.userAgent = userAgent
  const timeoutMs = resolved.fields.timeoutMs
  if (typeof timeoutMs === 'number' && timeoutMs > 0) cfg.timeoutMs = timeoutMs
  return cfg
}
