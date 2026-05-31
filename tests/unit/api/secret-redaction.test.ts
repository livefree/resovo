/**
 * secret-redaction.test.ts — ADR-168 secret redaction 三道协议纯函数单测（META-16-A）
 */
import { describe, it, expect } from 'vitest'
import { redactSecretsForAudit, maskSecret, isMaskedPlaceholder } from '@/api/lib/secretRedaction'
import { isSecretSettingKey, MASK_PREFIX } from '@/types'

describe('isSecretSettingKey — 命中/护栏（D-168-1）', () => {
  it.each(['douban_cookie', 'notification_webhook_secret', 'bangumi_api_token', 'tmdb_api_key', 'token', 'api_key'])(
    '命中 %s', (k) => expect(isSecretSettingKey(k)).toBe(true),
  )
  it.each(['notification_webhook_url', 'notification_email_to', 'douban_proxy', 'video_proxy_url', 'bangumi_user_agent', 'bangumi_api_timeout_ms', 'config_file_url', 'site_name'])(
    '不命中 %s', (k) => expect(isSecretSettingKey(k)).toBe(false),
  )
})

describe('redactSecretsForAudit（D-168-2）', () => {
  it('敏感键非空 → <set> / 空串|null → <cleared> / 非敏感原样', () => {
    expect(redactSecretsForAudit({
      bangumi_api_token: 'abcd1234',
      douban_cookie: '',
      notification_webhook_secret: null,
      site_name: 'Resovo',
      bangumi_user_agent: 'resovo/1.0',
    })).toEqual({
      bangumi_api_token: '<set>',
      douban_cookie: '<cleared>',
      notification_webhook_secret: '<cleared>',
      site_name: 'Resovo',
      bangumi_user_agent: 'resovo/1.0',
    })
  })
  it('null 入参 → null（保 ADR-118 audit 语义）', () => {
    expect(redactSecretsForAudit(null)).toBeNull()
  })
  it('undefined 值敏感键 → <cleared>', () => {
    expect(redactSecretsForAudit({ tmdb_api_key: undefined })).toEqual({ tmdb_api_key: '<cleared>' })
  })
})

describe('maskSecret（D-168-3）', () => {
  it('长凭证 → ••••后4位', () => {
    expect(maskSecret('abcdefghijklmnop')).toBe('••••mnop')
  })
  it('1–3 字符 → 全遮罩（不泄漏）', () => {
    expect(maskSecret('ab')).toBe(MASK_PREFIX)
    expect(maskSecret('abc')).toBe(MASK_PREFIX)
  })
  it('恰好 4 字符 → ••••+全 4 位', () => {
    expect(maskSecret('wxyz')).toBe('••••wxyz')
  })
  it('空串 → 空串（UI 判未配置）', () => {
    expect(maskSecret('')).toBe('')
  })
})

describe('isMaskedPlaceholder（D-168-4）', () => {
  it('遮罩值 → true（跳过写入）', () => {
    expect(isMaskedPlaceholder('••••mnop')).toBe(true)
    expect(isMaskedPlaceholder(MASK_PREFIX)).toBe(true)
  })
  it('明文新值 → false（覆盖）', () => {
    expect(isMaskedPlaceholder('new-token-value')).toBe(false)
  })
  it('空串 → false（清空语义，正常写空）', () => {
    expect(isMaskedPlaceholder('')).toBe(false)
  })
})
