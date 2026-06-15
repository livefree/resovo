/**
 * tests/unit/api/integration-credentials-service.test.ts —
 * ADR-173 D-173-4/5 IntegrationCredentialsService 单测（META-30 / Card B2）
 *
 * 覆盖：list 遮罩视图 + configured / save 占位跳过 + JSONB + 审计 redact /
 *       test 三态取值 + 草稿不持久化 + 审计不落候选 secret。
 * 含 audit payload 内容断言（满足 audit-log-coverage 守卫 R-MID-1）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'

vi.mock('@/api/db/queries/apiCredentials', () => ({
  listApiCredentialRows: vi.fn(),
  getApiCredentialRow: vi.fn(),
  upsertApiCredential: vi.fn().mockResolvedValue(undefined),
  updateApiCredentialTestStatus: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/api/services/integration-credentials-config', () => ({
  loadProviderCredential: vi.fn(),
}))
vi.mock('@/api/services/integration-credential-testers', () => ({
  testProviderCredential: vi.fn(),
}))

import { IntegrationCredentialsService } from '@/api/services/IntegrationCredentialsService'
import { AuditLogService } from '@/api/services/AuditLogService'
import {
  listApiCredentialRows,
  getApiCredentialRow,
  upsertApiCredential,
  updateApiCredentialTestStatus,
} from '@/api/db/queries/apiCredentials'
import { loadProviderCredential } from '@/api/services/integration-credentials-config'
import { testProviderCredential } from '@/api/services/integration-credential-testers'

const mList = vi.mocked(listApiCredentialRows)
const mGetRow = vi.mocked(getApiCredentialRow)
const mUpsert = vi.mocked(upsertApiCredential)
const mUpdateStatus = vi.mocked(updateApiCredentialTestStatus)
const mLoad = vi.mocked(loadProviderCredential)
const mTest = vi.mocked(testProviderCredential)

let writeSpy: ReturnType<typeof vi.spyOn>
const db = {} as Pool

function makeRow(over: Record<string, unknown> = {}) {
  return {
    provider: 'bangumi',
    secrets: { token: 'abcd1234' },
    config: { userAgent: 'UA/db', timeoutMs: 8000 },
    enabled: true,
    lastTestedAt: '2026-06-13T00:00:00Z',
    lastTestOk: true,
    lastTestLatencyMs: 200,
    lastTestError: null,
    updatedAt: '2026-06-13T00:00:00Z',
    updatedBy: 'admin-1',
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  writeSpy = vi.spyOn(AuditLogService.prototype, 'write').mockImplementation(() => {})
})

describe('IntegrationCredentialsService.listForAdmin', () => {
  it('secret 字段遮罩 + configured + 测试状态；无行源默认空+未配置', async () => {
    mList.mockResolvedValue([makeRow() as never])
    const svc = new IntegrationCredentialsService(db)
    const views = await svc.listForAdmin()
    const bangumi = views.find((v) => v.provider === 'bangumi')!
    expect(bangumi.values.token).toBe('••••1234') // maskSecret 后 4 位
    expect(bangumi.values.userAgent).toBe('UA/db') // 非 secret 明文
    expect(bangumi.configured).toBe(true)
    expect(bangumi.lastTestOk).toBe(true)
    const tmdb = views.find((v) => v.provider === 'tmdb')!
    expect(tmdb.values.read_access_token).toBe('') // 无行 → 空（ADR-201 字段拆分：read_access_token / api_key）
    expect(tmdb.values.api_key).toBe('')
    expect(tmdb.configured).toBe(false)
  })
})

describe('IntegrationCredentialsService.save', () => {
  it('明文 secret + config → upsert + 审计 redact <set>（actionType integration.credential_update）', async () => {
    mGetRow.mockResolvedValue(null)
    const svc = new IntegrationCredentialsService(db)
    await svc.save('bangumi', { token: 'plain-tok', userAgent: 'UA/x', timeoutMs: 9000 }, 'admin-1', 'req-1')

    expect(mUpsert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        provider: 'bangumi',
        secrets: { token: 'plain-tok' },
        config: { userAgent: 'UA/x', timeoutMs: 9000 },
        updatedBy: 'admin-1',
      }),
    )
    expect(writeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'integration.credential_update',
        targetKind: 'system',
        targetId: null,
        afterJsonb: expect.objectContaining({ provider: 'bangumi', token: '<set>', userAgent: 'UA/x', timeoutMs: 9000 }),
      }),
    )
  })

  it('遮罩占位回提 → 该 secret 跳过写入（防保存即清空）', async () => {
    mGetRow.mockResolvedValue(null)
    const svc = new IntegrationCredentialsService(db)
    await svc.save('bangumi', { token: '••••1234', userAgent: 'UA/y' }, 'admin-1', 'req-1')
    const arg = mUpsert.mock.calls[0]![1]
    expect(arg.secrets).toEqual({}) // 占位跳过 → secrets 不含 token
    expect(arg.config).toEqual({ userAgent: 'UA/y' })
  })

  it("空串 secret → 主动清空（审计 <cleared>）", async () => {
    mGetRow.mockResolvedValue(null)
    const svc = new IntegrationCredentialsService(db)
    await svc.save('bangumi', { token: '' }, 'admin-1', 'req-1')
    expect(mUpsert.mock.calls[0]![1].secrets).toEqual({ token: '' })
    expect(writeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'integration.credential_update',
        afterJsonb: expect.objectContaining({ token: '<cleared>' }),
      }),
    )
  })
})

describe('IntegrationCredentialsService.test', () => {
  it('draft=false（测已存）→ 持久化 last_test_* + 审计（actionType integration.credential_test）', async () => {
    mLoad.mockResolvedValue({ enabled: true, fields: { token: 'stored' } })
    mTest.mockResolvedValue({ ok: true, latencyMs: 100, authStatus: 'valid' })
    const svc = new IntegrationCredentialsService(db)
    const r = await svc.test('bangumi', {}, 'admin-1', 'req-1')

    expect(r.ok).toBe(true)
    expect(r.testedAt).toBeTruthy()
    expect(mUpdateStatus).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ provider: 'bangumi', ok: true, latencyMs: 100 }),
    )
    expect(writeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'integration.credential_test',
        targetKind: 'system',
        afterJsonb: expect.objectContaining({ provider: 'bangumi', draft: false, ok: true }),
      }),
    )
  })

  it('draft=true（测候选）→ 不持久化 last_test_*；候选覆盖已存；审计不落候选 secret', async () => {
    mLoad.mockResolvedValue({ enabled: true, fields: { token: 'stored' } })
    mTest.mockResolvedValue({ ok: true, latencyMs: 50, authStatus: 'valid' })
    const svc = new IntegrationCredentialsService(db)
    await svc.test('bangumi', { draft: true, token: 'candidate' }, 'admin-1', 'req-1')

    expect(mUpdateStatus).not.toHaveBeenCalled() // 草稿不污染行级状态
    expect(mTest).toHaveBeenCalledWith('bangumi', expect.objectContaining({ fields: expect.objectContaining({ token: 'candidate' }) }))
    // 审计 afterJsonb 不含候选 secret（token）
    const auditArg = writeSpy.mock.calls[0]![0] as { afterJsonb: Record<string, unknown> }
    expect(auditArg.afterJsonb).not.toHaveProperty('token')
  })

  it('draft=true 但 token 为遮罩占位 → 保留已存值测试（不覆盖）', async () => {
    mLoad.mockResolvedValue({ enabled: true, fields: { token: 'stored' } })
    mTest.mockResolvedValue({ ok: true, latencyMs: 50 })
    const svc = new IntegrationCredentialsService(db)
    await svc.test('bangumi', { draft: true, token: '••••1234' }, 'admin-1', 'req-1')
    expect(mTest).toHaveBeenCalledWith('bangumi', expect.objectContaining({ fields: expect.objectContaining({ token: 'stored' }) }))
  })
})
