/**
 * messages.test.ts — 消息中心 BFF + 列逻辑单测（ADR-196 D-196-4 / NTLG-P2-c-A-2）
 *
 * 覆盖：listMessages URL 参数序列化（cursor/q/level/readState/since/until 透传 + 省略不带）/
 *       computeRead 已读高水位线判定（D-192-AMD-4）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../apps/server-next/src/lib/api-client', () => ({
  apiClient: { get: vi.fn() },
}))

import { apiClient } from '../../../apps/server-next/src/lib/api-client'
import { listMessages } from '../../../apps/server-next/src/lib/messages/api'
import { computeRead } from '../../../apps/server-next/src/app/admin/messages/_client/MessageColumns'

const mockedGet = vi.mocked(apiClient.get)

beforeEach(() => {
  mockedGet.mockReset().mockResolvedValue({ data: [], meta: { total: 0, limit: 20, since: null, readAt: null, nextCursor: null } })
})

describe('listMessages — URL 参数序列化', () => {
  it('全参 → 透传 cursor/q/level/since/until/readState', async () => {
    await listMessages({
      limit: 20, cursor: 'abc', q: '视频', level: 'warn',
      since: '2026-06-01T00:00:00.000Z', until: '2026-06-09T23:59:59.999Z', readState: 'unread',
    })
    const url = mockedGet.mock.calls[0]![0] as string
    expect(url.startsWith('/admin/notifications?')).toBe(true)
    const qs = new URLSearchParams(url.split('?')[1])
    expect(qs.get('limit')).toBe('20')
    expect(qs.get('cursor')).toBe('abc')
    expect(qs.get('q')).toBe('视频')
    expect(qs.get('level')).toBe('warn')
    expect(qs.get('since')).toBe('2026-06-01T00:00:00.000Z')
    expect(qs.get('until')).toBe('2026-06-09T23:59:59.999Z')
    expect(qs.get('readState')).toBe('unread')
  })

  it('省略参数 → 不带（首页无 cursor / 无过滤）', async () => {
    await listMessages({ limit: 20 })
    const url = mockedGet.mock.calls[0]![0] as string
    const qs = new URLSearchParams(url.split('?')[1] ?? '')
    expect(qs.get('cursor')).toBeNull()
    expect(qs.get('q')).toBeNull()
    expect(qs.get('level')).toBeNull()
    expect(qs.get('readState')).toBeNull()
  })

  it('空 params → 无 query string', async () => {
    await listMessages({})
    expect(mockedGet.mock.calls[0]![0]).toBe('/admin/notifications')
  })
})

describe('computeRead — 已读高水位线判定 (D-192-AMD-4)', () => {
  const row = (createdAt: string) => ({
    id: '1', title: 't', level: 'info' as const, createdAt, read: false,
  })

  it('readAt=null → 恒未读（新用户无 cursor 基线）', () => {
    expect(computeRead(row('2026-06-09T08:00:00Z'), null)).toBe(false)
  })

  it('createdAt <= readAt → 已读', () => {
    expect(computeRead(row('2026-06-01T00:00:00Z'), '2026-06-05T00:00:00Z')).toBe(true)
    expect(computeRead(row('2026-06-05T00:00:00Z'), '2026-06-05T00:00:00Z')).toBe(true) // 边界含
  })

  it('createdAt > readAt → 未读', () => {
    expect(computeRead(row('2026-06-09T08:00:00Z'), '2026-06-05T00:00:00Z')).toBe(false)
  })
})
