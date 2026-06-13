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

/** 读全部源凭证行（供 GET 列表端点遍历注册表 + 行数据合并）。 */
export async function listApiCredentialRows(db: Pool): Promise<ApiCredentialRow[]> {
  const res = await db.query<DbRow>(`SELECT ${SELECT_COLUMNS} FROM api_credentials`)
  return res.rows.map(mapRow)
}

export interface UpsertApiCredentialInput {
  provider: string
  /** 本次要写入的敏感字段（占位跳过/清空三态由服务层决定后传入；空对象=不动 secrets） */
  secrets?: Record<string, unknown>
  /** 本次要写入的非敏感字段（空对象=不动 config） */
  config?: Record<string, unknown>
  /** 省略=保持原值（新行默认 true） */
  enabled?: boolean
  updatedBy: string | null
}

/**
 * 保存/更新单源凭证（ADR-173 D-173-4）：JSONB 顶层 `||` 合并——只覆盖本次提交的字段，
 * 同源未提交字段保留（防「保存即清空」）。enabled 省略时保持原值（新行默认 true）。
 */
export async function upsertApiCredential(db: Pool, input: UpsertApiCredentialInput): Promise<void> {
  await db.query(
    `INSERT INTO api_credentials (provider, secrets, config, enabled, updated_at, updated_by)
     VALUES ($1, $2::jsonb, $3::jsonb, COALESCE($4, TRUE), NOW(), $5)
     ON CONFLICT (provider) DO UPDATE SET
       secrets    = api_credentials.secrets || $2::jsonb,
       config     = api_credentials.config  || $3::jsonb,
       enabled    = COALESCE($4, api_credentials.enabled),
       updated_at = NOW(),
       updated_by = $5`,
    [
      input.provider,
      JSON.stringify(input.secrets ?? {}),
      JSON.stringify(input.config ?? {}),
      input.enabled ?? null,
      input.updatedBy,
    ],
  )
}

export interface TestStatusInput {
  provider: string
  ok: boolean
  latencyMs: number
  error: string | null
}

/**
 * 持久化「已保存配置」的连接测试状态（ADR-173 D-173-5）：仅 UPDATE 已存在行。
 * 草稿（未保存候选）测试不调用此函数（不污染行级状态）；无行时 UPDATE 0 行（env-only 源无处记录，可接受）。
 */
export async function updateApiCredentialTestStatus(db: Pool, input: TestStatusInput): Promise<void> {
  await db.query(
    `UPDATE api_credentials
        SET last_tested_at = NOW(), last_test_ok = $2, last_test_latency_ms = $3, last_test_error = $4
      WHERE provider = $1`,
    [input.provider, input.ok, input.latencyMs, input.error],
  )
}
