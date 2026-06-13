/**
 * integrations/api.ts — /admin/integrations/credentials 取数层（ADR-173 §端点契约）
 *
 * 对应后端 3 端点（list / save / test）。仅经 apiClient（ADR-003 不直 fetch）。
 * 响应形态镜像后端 IntegrationCredentialsService（非 @resovo/types 共享形态，故 UI 层声明，
 * 对齐 external-resources/api.ts 范式）；字段元数据真源 = @resovo/types PROVIDER_CREDENTIAL_SPECS。
 */
import { apiClient } from '@/lib/api-client'
import type { ProviderKey } from '@resovo/types'

/** GET 单源凭证视图（与 PROVIDER_CREDENTIAL_SPECS 组合渲染）。 */
export interface IntegrationCredentialView {
  readonly provider: ProviderKey
  readonly label: string
  /** 逐字段当前值：secret 遮罩（••••后4位 / 空），非 secret 明文 */
  readonly values: Record<string, string>
  readonly configured: boolean
  readonly enabled: boolean
  readonly lastTestedAt: string | null
  readonly lastTestOk: boolean | null
  readonly lastTestLatencyMs: number | null
  readonly lastTestError: string | null
}

export interface CredentialTestResult {
  readonly ok: boolean
  readonly latencyMs: number
  readonly error?: string
  readonly authStatus?: 'valid' | 'invalid' | 'not_required'
  readonly testedAt: string
}

/** 提交值（字符串/数字/布尔；secret 字段遮罩占位回提由后端跳过） */
export type CredentialPatch = Record<string, string | number | boolean>

export async function getIntegrationCredentials(): Promise<IntegrationCredentialView[]> {
  const result = await apiClient.get<{ data: { providers: IntegrationCredentialView[] } }>(
    '/admin/integrations/credentials',
  )
  return result.data.providers
}

export async function saveIntegrationCredential(provider: ProviderKey, patch: CredentialPatch): Promise<void> {
  await apiClient.put<{ data: { ok: true } }>(
    `/admin/integrations/credentials/${encodeURIComponent(provider)}`,
    patch,
  )
}

export async function testIntegrationCredential(
  provider: ProviderKey,
  body: CredentialPatch & { draft?: boolean },
): Promise<CredentialTestResult> {
  const result = await apiClient.post<{ data: CredentialTestResult }>(
    `/admin/integrations/credentials/${encodeURIComponent(provider)}/test`,
    body,
  )
  return result.data
}
