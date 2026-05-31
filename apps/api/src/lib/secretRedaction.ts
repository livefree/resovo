/**
 * secretRedaction.ts — 站点设置敏感凭证遮罩纯函数（ADR-168）
 *
 * 三道协议：
 *   - 审计 redaction（D-168-2）：redactSecretsForAudit —— 命中键替换为 `<set>`/`<cleared>`（零字符）
 *   - GET 遮罩（D-168-3）：maskSecret —— `••••后4位`（短凭证全遮罩）
 *   - PATCH 占位跳过（D-168-4）：isMaskedPlaceholder —— 识别遮罩回提，跳过写入保留原值
 *
 * 敏感键判定真源 = `@resovo/types` 的 SECRET_KEY_PATTERNS / isSecretSettingKey / MASK_PREFIX。
 */
import { isSecretSettingKey, MASK_PREFIX } from '@resovo/types'

/**
 * D-168-2：审计 before/after JSONB redaction。
 * 命中 SECRET_KEY_PATTERNS 的键：非空 → `'<set>'`；空串/null/undefined → `'<cleared>'`。
 * 非命中键原样透传。null 入参原样返回（保 ADR-118 audit before/after null 语义）。
 */
export function redactSecretsForAudit(
  rec: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (rec === null) return null
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(rec)) {
    if (isSecretSettingKey(k)) {
      const isSet = typeof v === 'string' ? v.length > 0 : v != null
      out[k] = isSet ? '<set>' : '<cleared>'
    } else {
      out[k] = v
    }
  }
  return out
}

/**
 * D-168-3：GET 响应遮罩。长度 ≥4 → `••••后4位`；1–3 → `••••`（全遮罩，不泄漏短凭证）；空串 → `''`。
 */
export function maskSecret(raw: string): string {
  if (raw.length === 0) return ''
  if (raw.length < 4) return MASK_PREFIX
  return `${MASK_PREFIX}${raw.slice(-4)}`
}

/**
 * D-168-4：PATCH 占位识别。true → 该敏感键为遮罩回提，跳过写入（保留 DB 原值，防「保存即清空」）。
 */
export function isMaskedPlaceholder(value: string): boolean {
  return value.startsWith(MASK_PREFIX)
}
