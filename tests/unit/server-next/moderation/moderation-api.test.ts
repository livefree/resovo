import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../../apps/server-next/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}))

vi.mock('../../../../apps/server-next/src/stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({ accessToken: null })),
}))

import { toDisplayState } from '../../../../apps/server-next/src/lib/moderation/api'

describe('moderation/api — toDisplayState', () => {
  it('ok 映射为 ok', () => {
    expect(toDisplayState('ok')).toBe('ok')
  })

  it('partial 映射为 partial', () => {
    expect(toDisplayState('partial')).toBe('partial')
  })

  it('dead 映射为 dead', () => {
    expect(toDisplayState('dead')).toBe('dead')
  })

  it('pending 映射为 pending', () => {
    expect(toDisplayState('pending')).toBe('pending')
  })

  it('空字符串映射为 unknown', () => {
    expect(toDisplayState('')).toBe('unknown')
  })

  it('未知值映射为 unknown', () => {
    expect(toDisplayState('error')).toBe('unknown')
  })

  it('null 字符串映射为 unknown', () => {
    expect(toDisplayState('null')).toBe('unknown')
  })
})

describe('moderation/api — M（i18n）', () => {
  it('todayStats 正确格式化通过率', async () => {
    const { M } = await import('../../../../apps/server-next/src/i18n/messages/zh-CN/moderation')
    const result = M.todayStats(27, 81.0)
    expect(result).toContain('27')
    expect(result).toContain('81%')
  })

  it('todayStats 通过率为 null 时显示 —', async () => {
    const { M } = await import('../../../../apps/server-next/src/i18n/messages/zh-CN/moderation')
    const result = M.todayStats(0, null)
    expect(result).toContain('—')
  })

  it('counter 格式化正确', async () => {
    const { M } = await import('../../../../apps/server-next/src/i18n/messages/zh-CN/moderation')
    expect(M.counter(3, 100)).toBe('第 3 / 100')
  })

  it('staging.listHeader 格式化正确', async () => {
    const { M } = await import('../../../../apps/server-next/src/i18n/messages/zh-CN/moderation')
    expect(M.staging.listHeader(5)).toContain('5')
  })

  it('rejected.listHeader 格式化正确', async () => {
    const { M } = await import('../../../../apps/server-next/src/i18n/messages/zh-CN/moderation')
    expect(M.rejected.listHeader(3)).toContain('3')
  })
})
