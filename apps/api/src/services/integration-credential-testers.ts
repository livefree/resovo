/**
 * integration-credential-testers.ts — provider 连接测试适配器注册表（ADR-173 D-173-6）
 *
 * 每源一个测试适配器：把已解析凭证（ResolvedCredential）映射为各 lib 的 testConnection 调用。
 * 接新源 = 追加一条适配器 + 实现其 lib testConnection。未接源（douban/imdb）返回 unsupported。
 * 测试适配器 source-agnostic：候选（草稿）值与已存值均经 ResolvedCredential 传入（服务层构造）。
 */

import type { ProviderKey } from '@resovo/types'
import * as bangumiLib from '@/api/lib/bangumi'
import * as tmdbLib from '@/api/lib/tmdb'
import type { ResolvedCredential } from './integration-credentials-config'

export interface CredentialTestResult {
  ok: boolean
  latencyMs: number
  error?: string
  authStatus?: 'valid' | 'invalid' | 'not_required'
}

type Tester = (resolved: ResolvedCredential) => Promise<CredentialTestResult>

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

const bangumiTester: Tester = (resolved) =>
  bangumiLib.testConnection({
    token: str(resolved.fields.token),
    userAgent: str(resolved.fields.userAgent),
    timeoutMs: num(resolved.fields.timeoutMs),
  })

const tmdbTester: Tester = (resolved) =>
  tmdbLib.testConnection({
    token: str(resolved.fields.token),
    baseUrl: str(resolved.fields.baseUrl),
    language: str(resolved.fields.language),
  })

const unsupportedTester: Tester = async () => ({ ok: false, latencyMs: 0, error: 'unsupported' })

export const CREDENTIAL_TESTERS: Record<ProviderKey, Tester> = {
  bangumi: bangumiTester,
  tmdb: tmdbTester,
  douban: unsupportedTester,
  imdb: unsupportedTester,
}

/** 按 provider 分派测试适配器（未知 provider → unsupported）。 */
export async function testProviderCredential(
  provider: ProviderKey,
  resolved: ResolvedCredential,
): Promise<CredentialTestResult> {
  const tester = CREDENTIAL_TESTERS[provider] ?? unsupportedTester
  return tester(resolved)
}
