/**
 * apiCredentials.ts — api_credentials 表查询（ADR-173）
 *
 * 外部数据源 API 凭证一源一行。secrets/config 物理分列（遮罩真源 = 注册表 secret flag，D-173-4）。
 * 本卡（META-26 / Card A2）只含读取路径所需 getApiCredentialRow；
 * upsert / 测试状态写入在 META-27（Card B）追加。
 */

import type { Pool } from 'pg'

interface DbRow {
  provider: string
  secrets: Record<string, unknown>
  config: Record<string, unknown>
  enabled: boolean
  last_tested_at: string | null
  last_test_ok: boolean | null
  last_test_latency_ms: number | null
  last_test_error: string | null
  updated_at: string
  updated_by: string | null
}

export interface ApiCredentialRow {
  provider: string
  /** 敏感字段 map（{ token?, ... }）；消费侧遮罩/redact 以注册表 secret flag 为准 */
  secrets: Record<string, unknown>
  /** 非敏感字段 map（{ userAgent?, timeoutMs?, baseUrl?, language? }） */
  config: Record<string, unknown>
  enabled: boolean
  lastTestedAt: string | null
  lastTestOk: boolean | null
  lastTestLatencyMs: number | null
  lastTestError: string | null
  updatedAt: string
  updatedBy: string | null
}

const SELECT_COLUMNS =
  'provider, secrets, config, enabled, last_tested_at, last_test_ok, last_test_latency_ms, last_test_error, updated_at, updated_by'

function mapRow(r: DbRow): ApiCredentialRow {
  return {
    provider: r.provider,
    secrets: r.secrets ?? {},
    config: r.config ?? {},
    enabled: r.enabled,
    lastTestedAt: r.last_tested_at,
    lastTestOk: r.last_test_ok,
    lastTestLatencyMs: r.last_test_latency_ms,
    lastTestError: r.last_test_error,
    updatedAt: r.updated_at,
    updatedBy: r.updated_by,
  }
}

/** 读单源凭证行；无行返回 null（缺行由解析器走旧 KV/env fallback，D-173-8）。 */
export async function getApiCredentialRow(db: Pool, provider: string): Promise<ApiCredentialRow | null> {
  const res = await db.query<DbRow>(
    `SELECT ${SELECT_COLUMNS} FROM api_credentials WHERE provider = $1`,
    [provider],
  )
  const row = res.rows[0]
  return row ? mapRow(row) : null
}
