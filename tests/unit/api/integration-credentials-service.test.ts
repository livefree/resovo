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

vi.mock('@/api/db/queries/apiCredentials', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/db/queries/apiCredentials')>()
  return {
    ...actual, // 保留真实 normalizeRowSecrets / LEGACY_ROW_SECRET_KEYS（纯函数/常量）
    listApiCredentialRows: vi.fn(),
    getApiCredentialRow: vi.fn(),
    upsertApiCredential: vi.fn().mockResolvedValue(undefined),
    updateApiCredentialTestStatus: vi.fn().mockResolvedValue(undefined),
  }
})
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

  it('旧行兼容：tmdb 仅 secrets.token（未迁移）→ read_access_token 遮罩 + configured（ADR-201 22823）', async () => {
    mList.mockResolvedValue([makeRow({ provider: 'tmdb', secrets: { token: 'old-bearer' }, config: {} }) as never])
    const svc = new IntegrationCredentialsService(db)
    const views = await svc.listForAdmin()
    const tmdb = views.find((v) => v.provider === 'tmdb')!
    expect(tmdb.configured).toBe(true) // 旧行有 Bearer → 已配置（不误显示「未配置」）
    expect(tmdb.values.read_access_token).not.toBe('') // 遮罩值（来自旧 token）
    expect(tmdb.values.api_key).toBe('')
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

  it('旧行只改 baseUrl：save 不碰 secrets（不删/不迁 token）→ token 保留由读路径兜底，不写回快照值', async () => {
    mGetRow.mockResolvedValue(makeRow({ provider: 'tmdb', secrets: { token: 'old-bearer' }, config: {} }) as never)
    const svc = new IntegrationCredentialsService(db)
    await svc.save('tmdb', { baseUrl: 'https://x/3' }, 'admin-1', 'req-1')
    const arg = mUpsert.mock.calls[0]![1]
    expect(arg.dropSecretKeys).toEqual([]) // 未提交 read_access_token → 不删 token
    expect(arg.secrets).toEqual({}) // 不碰 secrets（token 保留，读路径 normalizeRowSecrets 兜底）
    expect(arg.config).toEqual({ baseUrl: 'https://x/3' })
  })

  it('旧行提交新 read_access_token：删 token + 写新值（凭证切换到新字段，杜绝旧 token fallback 残留）', async () => {
    mGetRow.mockResolvedValue(makeRow({ provider: 'tmdb', secrets: { token: 'old-bearer' }, config: {} }) as never)
    const svc = new IntegrationCredentialsService(db)
    await svc.save('tmdb', { read_access_token: 'new-rat' }, 'admin-1', 'req-1')
    const arg = mUpsert.mock.calls[0]![1]
    expect(arg.dropSecretKeys).toEqual(['token']) // 提交新 key → 删旧 token
    expect(arg.secrets).toEqual({ read_access_token: 'new-rat' })
  })

  it('旧行清空：DB secrets.token 残留 + 提交 read_access_token=空 → 删 token + 不固化（真清空，杜绝 fallback 残留）', async () => {
    mGetRow.mockResolvedValue(makeRow({ provider: 'tmdb', secrets: { token: 'old-bearer' }, config: {} }) as never)
    const svc = new IntegrationCredentialsService(db)
    await svc.save('tmdb', { read_access_token: '' }, 'admin-1', 'req-1')
    const arg = mUpsert.mock.calls[0]![1]
    expect(arg.dropSecretKeys).toEqual(['token'])
    expect(arg.secrets).toEqual({ read_access_token: '' }) // 提交空 → 不固化，token 删除 → loader 读不到 → 真清空
  })

  it('并发安全：DB token(陈旧) + read_access_token(较新) + 只改 baseUrl → 不碰 secrets（零覆盖风险，含并发）', async () => {
    // 竞态：A 读 before 后 B 并发写 read_access_token；A 只改 baseUrl 时不触碰 secrets/不写回快照 →
    // upsert merge 仅动 config，B 的较新凭证绝不被 A 的陈旧快照覆盖。
    mGetRow.mockResolvedValue(
      makeRow({ provider: 'tmdb', secrets: { token: 'stale-old', read_access_token: 'fresh-new' }, config: {} }) as never,
    )
    const svc = new IntegrationCredentialsService(db)
    await svc.save('tmdb', { baseUrl: 'https://x/3' }, 'admin-1', 'req-1')
    const arg = mUpsert.mock.calls[0]![1]
    expect(arg.dropSecretKeys).toEqual([]) // 未提交 read_access_token → 不删 token
    expect(arg.secrets).toEqual({}) // 不碰 secrets → 较新凭证零覆盖（读路径 normalizeRowSecrets 仍优先新值）
    expect(arg.config).toEqual({ baseUrl: 'https://x/3' })
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

  it('P2 修复：以 includeDisabled 加载凭证 → 禁用但已保存的源仍测真实凭证（非空）', async () => {
    // enabled=false 但有已存字段：test() 须传 includeDisabled 让解析器加载存值，否则测空凭证误报失败。
    mLoad.mockResolvedValue({ enabled: false, fields: { token: 'stored' } })
    mTest.mockResolvedValue({ ok: true, latencyMs: 80, authStatus: 'valid' })
    const svc = new IntegrationCredentialsService(db)
    const r = await svc.test('bangumi', {}, 'admin-1', 'req-1')

    expect(mLoad).toHaveBeenCalledWith(expect.anything(), 'bangumi', { includeDisabled: true })
    // 测的是已存凭证（token=stored）而非空集
    expect(mTest).toHaveBeenCalledWith('bangumi', expect.objectContaining({ fields: expect.objectContaining({ token: 'stored' }) }))
    expect(r.ok).toBe(true)
  })
})
