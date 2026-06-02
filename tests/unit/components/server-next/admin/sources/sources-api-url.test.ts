/**
 * sources-api-url.test.ts — HOTFIX-PATCH-2A（2026-05-25）
 *
 * 覆盖 `apps/server-next/src/lib/sources/api.ts#listVideoGroups` URLSearchParams 透传：
 *   - §1-BUG-1: sortField + sortDir（4df39524 漏改回填）
 *   - §2-EXT-1/2: probeStatus + renderStatus 多选 csv join
 *   - §1-BUG-3: updatedAtFrom + updatedAtTo 日期范围
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiClientGetMock = vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 })

vi.mock('../../../../../../apps/server-next/src/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => apiClientGetMock(...args),
  },
}))

import { listVideoGroups } from '../../../../../../apps/server-next/src/lib/sources/api'

describe('listVideoGroups URL params', () => {
  beforeEach(() => {
    apiClientGetMock.mockClear()
  })

  it('§1-BUG-1: sortField + sortDir 透传', async () => {
    await listVideoGroups({ sortField: 'video', sortDir: 'asc' })
    const url = apiClientGetMock.mock.calls[0][0] as string
    expect(url).toContain('sortField=video')
    expect(url).toContain('sortDir=asc')
  })

  it('§1-BUG-1: 未传 sortField → URL 不含该字段', async () => {
    await listVideoGroups({})
    const url = apiClientGetMock.mock.calls[0][0] as string
    expect(url).not.toContain('sortField=')
    expect(url).not.toContain('sortDir=')
  })

  it('§2-EXT-1: probeStatus 多选 csv join', async () => {
    await listVideoGroups({ probeStatus: ['ok', 'dead'] })
    const url = apiClientGetMock.mock.calls[0][0] as string
    expect(url).toContain('probeStatus=ok%2Cdead')
  })

  it('§2-EXT-2: renderStatus 多选 csv join', async () => {
    await listVideoGroups({ renderStatus: ['partial', 'pending'] })
    const url = apiClientGetMock.mock.calls[0][0] as string
    expect(url).toContain('renderStatus=partial%2Cpending')
  })

  it('空数组 probeStatus → URL 不含该字段', async () => {
    await listVideoGroups({ probeStatus: [] })
    const url = apiClientGetMock.mock.calls[0][0] as string
    expect(url).not.toContain('probeStatus=')
  })

  it('§PATCH-2B: siteKey 多选 csv join', async () => {
    await listVideoGroups({ siteKey: ['bilibili', 'youku'] })
    const url = apiClientGetMock.mock.calls[0][0] as string
    expect(url).toContain('siteKey=bilibili%2Cyouku')
  })

  it('§PATCH-2B: 空 siteKey 数组 → URL 不含该字段', async () => {
    await listVideoGroups({ siteKey: [] })
    const url = apiClientGetMock.mock.calls[0][0] as string
    expect(url).not.toContain('siteKey=')
  })

  it('§1-BUG-3: updatedAtFrom + updatedAtTo 透传', async () => {
    await listVideoGroups({ updatedAtFrom: '2026-05-01', updatedAtTo: '2026-05-25' })
    const url = apiClientGetMock.mock.calls[0][0] as string
    expect(url).toContain('updatedAtFrom=2026-05-01')
    expect(url).toContain('updatedAtTo=2026-05-25')
  })

  it('全参数复合透传：sort + filter + 日期范围（CHG-VSR-5-B：segment 已删）', async () => {
    await listVideoGroups({
      page: 2,
      limit: 50,
      keyword: '黑客',
      siteKey: ['bilibili'],
      sortField: 'activeSources',
      sortDir: 'desc',
      probeStatus: ['ok'],
      renderStatus: ['partial', 'dead'],
      lastCheckedFrom: '2026-05-01',
      lastCheckedTo: '2026-05-25',
    })
    const url = apiClientGetMock.mock.calls[0][0] as string
    expect(url).toContain('page=2')
    expect(url).toContain('limit=50')
    expect(url).toContain('keyword=%E9%BB%91%E5%AE%A2')
    expect(url).not.toContain('segment')
    expect(url).toContain('siteKey=bilibili')
    expect(url).toContain('sortField=activeSources')
    expect(url).toContain('sortDir=desc')
    expect(url).toContain('probeStatus=ok')
    expect(url).toContain('renderStatus=partial%2Cdead')
    expect(url).toContain('lastCheckedFrom=2026-05-01')
    expect(url).toContain('lastCheckedTo=2026-05-25')
  })

  it('CHG-VSR-5-B：quickFilters csv + lowQuality 透传（KPI 卡 + 质量列筛选）', async () => {
    await listVideoGroups({ quickFilters: ['has_abnormal', 'low_quality'], lowQuality: true })
    const url = apiClientGetMock.mock.calls[0][0] as string
    expect(url).toContain('quickFilters=has_abnormal%2Clow_quality')
    expect(url).toContain('lowQuality=true')
  })

  it('CHG-VSR-5-B：lowQuality=false 不发送（仅 true 透传）', async () => {
    await listVideoGroups({ lowQuality: false })
    const url = apiClientGetMock.mock.calls[0][0] as string
    expect(url).not.toContain('lowQuality')
  })
})
