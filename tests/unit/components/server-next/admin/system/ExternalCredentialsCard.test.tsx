/**
 * ExternalCredentialsCard.test.tsx — ADR-173 / META-28 注册表驱动凭证卡单测
 *
 * 覆盖：多源卡渲染（bangumi/tmdb，按 PROVIDER_CREDENTIAL_SPECS）/ secret 字段 password 显隐 /
 *       保存调用 / 测试连接（draft=true）+ 结果展示 / 已配置·上次测试状态行。
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const getMock = vi.fn()
const saveMock = vi.fn()
const testMock = vi.fn()
const toastPushMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/integrations/api', () => ({
  getIntegrationCredentials: (...a: unknown[]) => getMock(...a),
  saveIntegrationCredential: (...a: unknown[]) => saveMock(...a),
  testIntegrationCredential: (...a: unknown[]) => testMock(...a),
}))

vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    useToast: () => ({ push: (i: unknown) => { toastPushMock(i); return 'tid' }, dismiss: vi.fn(), dismissAll: vi.fn() }),
  }
})

import { ExternalCredentialsCard } from '../../../../../../apps/server-next/src/app/admin/settings/_tabs/_external/ExternalCredentialsCard'

const BANGUMI_VIEW = {
  provider: 'bangumi',
  label: 'Bangumi',
  values: { token: '••••1234', userAgent: 'resovo/1.0', timeoutMs: '8000' },
  configured: true,
  enabled: true,
  lastTestedAt: '2026-06-13T00:00:00Z',
  lastTestOk: true,
  lastTestLatencyMs: 200,
  lastTestError: null,
}
const TMDB_VIEW = {
  provider: 'tmdb',
  label: 'TMDb',
  values: { read_access_token: '', api_key: '', baseUrl: 'https://api.themoviedb.org/3', language: 'zh-CN' },
  configured: false,
  enabled: true,
  lastTestedAt: null,
  lastTestOk: null,
  lastTestLatencyMs: null,
  lastTestError: null,
}

beforeEach(() => {
  getMock.mockReset()
  saveMock.mockReset()
  testMock.mockReset()
  toastPushMock.mockReset()
})

describe('ExternalCredentialsCard', () => {
  // AdminInput 把 data-testid 置于 wrapper，真实 <input> 为子元素（对齐 SettingsTab 测试）
  const tokenInput = () =>
    screen.getByTestId('integration-bangumi-token').querySelector('input') as HTMLInputElement

  it('按注册表渲染 bangumi + tmdb 多源卡 + 已配置状态行', async () => {
    getMock.mockResolvedValueOnce([BANGUMI_VIEW, TMDB_VIEW])
    render(<ExternalCredentialsCard />)
    await waitFor(() => expect(screen.getByTestId('integration-card-bangumi')).not.toBeNull())
    expect(screen.getByTestId('integration-card-tmdb')).not.toBeNull()
    // bangumi secret 字段 password
    expect(tokenInput().getAttribute('type')).toBe('password')
    expect(screen.getByTestId('integration-bangumi-status').textContent).toContain('已配置')
    expect(screen.getByTestId('integration-tmdb-status').textContent).toContain('未配置')
    // tmdb auth_method：双 secret 字段皆空 → 未配置（ADR-201 22811）
    expect(screen.getByTestId('integration-tmdb-auth-method').textContent).toContain('未配置')
  })

  it('tmdb 已配 read_access_token：auth_method 显示 Bearer 首选', async () => {
    getMock.mockResolvedValueOnce([
      BANGUMI_VIEW,
      { ...TMDB_VIEW, values: { ...TMDB_VIEW.values, read_access_token: '••••rat9' }, configured: true },
    ])
    render(<ExternalCredentialsCard />)
    await waitFor(() => screen.getByTestId('integration-card-tmdb'))
    expect(screen.getByTestId('integration-tmdb-auth-method').textContent).toContain('Bearer')
    expect(screen.getByTestId('integration-tmdb-status').textContent).toContain('已配置')
  })

  it('secret 字段显隐切换', async () => {
    getMock.mockResolvedValueOnce([BANGUMI_VIEW, TMDB_VIEW])
    render(<ExternalCredentialsCard />)
    await waitFor(() => screen.getByTestId('integration-bangumi-token'))
    fireEvent.click(screen.getByTestId('integration-bangumi-token-toggle'))
    await waitFor(() => expect(tokenInput().getAttribute('type')).toBe('text'))
  })

  it('保存：调用 saveIntegrationCredential(provider, patch 含 enabled)', async () => {
    getMock.mockResolvedValue([BANGUMI_VIEW, TMDB_VIEW]) // 初次 + 保存后刷新
    saveMock.mockResolvedValueOnce(undefined)
    render(<ExternalCredentialsCard />)
    await waitFor(() => screen.getByTestId('integration-bangumi-save'))
    fireEvent.click(screen.getByTestId('integration-bangumi-save'))
    await waitFor(() => expect(saveMock).toHaveBeenCalled())
    expect(saveMock.mock.calls[0][0]).toBe('bangumi')
    expect(saveMock.mock.calls[0][1]).toMatchObject({ enabled: true, userAgent: 'resovo/1.0', timeoutMs: 8000 })
  })

  it('保存成功后刷新视图（防 stale 误导态）：重取凭证 + 回显最新遮罩值/状态', async () => {
    // 初次未配置（token 空）→ 保存后刷新返回已配置（遮罩值）
    getMock.mockResolvedValueOnce([{ ...BANGUMI_VIEW, values: { ...BANGUMI_VIEW.values, token: '' }, configured: false }, TMDB_VIEW])
    saveMock.mockResolvedValueOnce(undefined)
    getMock.mockResolvedValueOnce([{ ...BANGUMI_VIEW, values: { ...BANGUMI_VIEW.values, token: '••••9999' }, configured: true }, TMDB_VIEW])
    render(<ExternalCredentialsCard />)
    await waitFor(() => expect(screen.getByTestId('integration-bangumi-status').textContent).toContain('未配置'))
    fireEvent.click(screen.getByTestId('integration-bangumi-save'))
    // 保存后重取 → 状态行刷新为「已配置」+ 输入框回显最新遮罩值（重挂卡）
    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByTestId('integration-bangumi-status').textContent).toContain('已配置'))
    await waitFor(() =>
      expect(
        (screen.getByTestId('integration-bangumi-token').querySelector('input') as HTMLInputElement).value,
      ).toBe('••••9999'),
    )
  })

  it('测试连接：draft=true 调用 + 展示结果', async () => {
    getMock.mockResolvedValueOnce([BANGUMI_VIEW, TMDB_VIEW])
    testMock.mockResolvedValueOnce({ ok: true, latencyMs: 50, authStatus: 'valid', testedAt: '2026-06-13T00:00:00Z' })
    render(<ExternalCredentialsCard />)
    await waitFor(() => screen.getByTestId('integration-bangumi-test'))
    fireEvent.click(screen.getByTestId('integration-bangumi-test'))
    await waitFor(() => expect(testMock).toHaveBeenCalled())
    expect(testMock.mock.calls[0][0]).toBe('bangumi')
    expect(testMock.mock.calls[0][1]).toMatchObject({ draft: true })
    await waitFor(() =>
      expect(screen.getByTestId('integration-bangumi-test-result').textContent).toContain('连接测试通过'),
    )
  })

  it('加载失败 → ErrorState', async () => {
    getMock.mockRejectedValueOnce(new Error('boom'))
    render(<ExternalCredentialsCard />)
    await waitFor(() => expect(screen.getByText('加载失败')).not.toBeNull())
  })
})
