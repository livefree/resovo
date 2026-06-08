/**
 * bangumi-config.ts — Bangumi 凭证解析（ADR-168 D-168-5）
 *
 * 从 system_settings 解析 token/UA/timeout，仅注入 DB 有值字段（缺省由 lib/bangumi 回退 process.env）。
 * BangumiService（60s 缓存包裹）与 BangumiResourceAdapter（治理在线搜索）共享，避免逻辑重复。
 */

import type { Pool } from 'pg'
import * as systemSettingsQueries from '@/api/db/queries/systemSettings'
import type { BangumiClientConfig } from '@/api/lib/bangumi'

export async function loadBangumiClientConfig(db: Pool): Promise<BangumiClientConfig> {
  const raw = await systemSettingsQueries.getAllSettings(db)
  const cfg: BangumiClientConfig = {}
  if (raw.bangumi_api_token) cfg.token = raw.bangumi_api_token
  if (raw.bangumi_user_agent) cfg.userAgent = raw.bangumi_user_agent
  const t = Number(raw.bangumi_api_timeout_ms)
  if (Number.isFinite(t) && t > 0) cfg.timeoutMs = t
  return cfg
}
