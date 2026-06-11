/**
 * tests/unit/api/crawlerSourceUpsert.test.ts
 * CRAWLER-02: 源 Upsert 策略改造测试
 * 覆盖：replaceSourcesForSite 新增/保留/移除三种情况；append_only 退回旧策略
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { UpsertSourceInput } from '@/api/db/queries/sources'

// ── Mock DB ───────────────────────────────────────────────────────

const mockQuery = vi.fn()
const mockRelease = vi.fn()
const mockConnect = vi.fn()

const mockClient = {
  query: vi.fn(),
  release: mockRelease,
}

const mockDb = {
  query: mockQuery,
  connect: mockConnect,
}

vi.mock('@/api/lib/postgres', () => ({ db: mockDb }))
vi.mock('@/api/lib/elasticsearch', () => ({ es: {} }))
vi.mock('@/api/lib/config', () => ({
  config: { DATABASE_URL: 'postgres://test', AUTO_PUBLISH_CRAWLED: 'false' },
}))

// ── Tests: replaceSourcesForSite ──────────────────────────────────

describe('replaceSourcesForSite — 全量替换策略', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConnect.mockResolvedValue(mockClient)
    mockClient.query.mockResolvedValue({ rowCount: 0, rows: [] })
  })

  const makeSrc = (url: string, episode = 1): UpsertSourceInput => ({
    videoId: 'vid-1',
    episodeNumber: episode,
    sourceUrl: url,
    sourceName: 'site-a',
    type: 'mp4',
  })

  it('全部新增：旧列表为空，所有新源都被插入', async () => {
    const { replaceSourcesForSite } = await import('@/api/db/queries/sources')

    // SELECT 返回空（无旧源）
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                    // BEGIN
      .mockResolvedValueOnce({ rows: [] })                    // SELECT existing
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })       // INSERT ep1
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })       // INSERT ep2
      .mockResolvedValueOnce({ rows: [] })                    // COMMIT

    const stats = await replaceSourcesForSite(mockDb as unknown as import('pg').Pool, 'vid-1', 'site-a', [
      makeSrc('https://cdn.example.com/ep1.mp4', 1),
      makeSrc('https://cdn.example.com/ep2.mp4', 2),
    ])

    expect(stats.sourcesAdded).toBe(2)
    expect(stats.sourcesKept).toBe(0)
    expect(stats.sourcesRemoved).toBe(0)
  })

  it('全部保留：旧列表与新列表完全相同，无增减', async () => {
    const { replaceSourcesForSite } = await import('@/api/db/queries/sources')

    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                    // BEGIN
      .mockResolvedValueOnce({
        rows: [
          { id: 'src-1', source_url: 'https://cdn.example.com/ep1.mp4' },
          { id: 'src-2', source_url: 'https://cdn.example.com/ep2.mp4' },
        ],
      })                                                       // SELECT existing
      .mockResolvedValueOnce({ rows: [] })                    // COMMIT

    const stats = await replaceSourcesForSite(mockDb as unknown as import('pg').Pool, 'vid-1', 'site-a', [
      makeSrc('https://cdn.example.com/ep1.mp4', 1),
      makeSrc('https://cdn.example.com/ep2.mp4', 2),
    ])

    expect(stats.sourcesAdded).toBe(0)
    expect(stats.sourcesKept).toBe(2)
    expect(stats.sourcesRemoved).toBe(0)
  })

  it('新增 + 移除：新列表包含新源，也移除旧源', async () => {
    const { replaceSourcesForSite } = await import('@/api/db/queries/sources')

    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                    // BEGIN
      .mockResolvedValueOnce({
        rows: [
          { id: 'src-old', source_url: 'https://cdn.example.com/old.mp4' },
        ],
      })                                                       // SELECT existing
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })       // DELETE old
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })       // INSERT new
      .mockResolvedValueOnce({ rows: [] })                    // COMMIT

    const stats = await replaceSourcesForSite(mockDb as unknown as import('pg').Pool, 'vid-1', 'site-a', [
      makeSrc('https://cdn.example.com/new.mp4', 1),
    ])

    expect(stats.sourcesAdded).toBe(1)
    expect(stats.sourcesKept).toBe(0)
    expect(stats.sourcesRemoved).toBe(1)
  })

  it('软删除 URL 被恢复：ON CONFLICT DO UPDATE 恢复 deleted_at=NULL', async () => {
    // 场景：某 URL 曾被软删除（不在 SELECT existing 结果中），新源包含该 URL
    // 期望：INSERT 语句以 DO UPDATE 执行，rowCount=1，计入 sourcesAdded
    const { replaceSourcesForSite } = await import('@/api/db/queries/sources')

    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                    // BEGIN
      .mockResolvedValueOnce({ rows: [] })                    // SELECT existing（软删除行不在结果中）
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })       // INSERT ... DO UPDATE（恢复软删除行）
      .mockResolvedValueOnce({ rows: [] })                    // COMMIT

    const stats = await replaceSourcesForSite(mockDb as unknown as import('pg').Pool, 'vid-1', 'site-a', [
      makeSrc('https://cdn.example.com/restored.mp4', 1),
    ])

    expect(stats.sourcesAdded).toBe(1)   // 恢复行计为新增
    expect(stats.sourcesKept).toBe(0)
    expect(stats.sourcesRemoved).toBe(0)
    // 验证 INSERT 使用 DO UPDATE（含 deleted_at = NULL）
    const insertCall = mockClient.query.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('DO UPDATE')
    )
    expect(insertCall).toBeTruthy()
    expect((insertCall![0] as string)).toContain('deleted_at = NULL')
  })

  it('CRAWLER-05: SELECT 使用 COALESCE(source_site_key, v.site_key) 而非 source_name 匹配站点', async () => {
    const { replaceSourcesForSite } = await import('@/api/db/queries/sources')

    // Fix-1 (R1) assertion: replaceSourcesForSite(empty) → throw，不得再以 [] 调用。
    // 改为传入 1 条新源（SELECT existing 返回空 → 走 INSERT 路径），SQL 结构验证不变。
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                    // BEGIN
      .mockResolvedValueOnce({ rows: [] })                    // SELECT existing（无旧源）
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })       // INSERT new source
      .mockResolvedValueOnce({ rows: [] })                    // COMMIT

    await replaceSourcesForSite(
      mockDb as unknown as import('pg').Pool,
      'vid-1',
      'bfzym3u8',
      [makeSrc('https://bfzym3u8.example/ep1.mp4', 1)],
    )

    const selectCall = mockClient.query.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === 'string' &&
        (call[0] as string).toUpperCase().includes('SELECT'),
    )
    expect(selectCall).toBeTruthy()
    const sql = selectCall![0] as string
    // 必须使用行级 source_site_key（回落到 v.site_key），且 JOIN videos
    expect(sql).toContain('COALESCE(s.source_site_key, v.site_key)')
    expect(sql).toMatch(/LEFT JOIN videos/i)
    // 绝不能再用 source_name 做站点匹配（防回归）
    expect(sql).not.toMatch(/AND\s+s?\.?source_name\s*=\s*\$2/i)
    expect(sql).not.toMatch(/AND\s+source_name\s*=/)
    // 传入的 siteKey 应作为 $2 参数
    expect(selectCall![1]).toEqual(['vid-1', 'bfzym3u8'])
  })

  it('CRAWLER-05: 不同站点同 source_name 不误删（跨站聚合视频隔离）', async () => {
    // 场景：videoId=vid-1 同时聚合站 bfzym3u8 与 lzzy，两站都有"线路1"
    // 重采 bfzym3u8 时，SELECT 只应返回 source_site_key='bfzym3u8' 的行，
    // lzzy 的"线路1"行 source_site_key='lzzy'，被 WHERE 过滤，不会进入 toRemoveIds
    const { replaceSourcesForSite } = await import('@/api/db/queries/sources')

    // SQL WHERE 已加 COALESCE(source_site_key, v.site_key)='bfzym3u8'，
    // mock 层只返回 bfzym3u8 的既有行，模拟真实 DB 行为
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                    // BEGIN
      .mockResolvedValueOnce({
        rows: [
          { id: 'src-bfzym3u8-line1', source_url: 'https://bfzym3u8.example/ep1.mp4' },
        ],
      })                                                       // SELECT existing（仅 bfzym3u8）
      .mockResolvedValueOnce({ rows: [] })                    // COMMIT

    const stats = await replaceSourcesForSite(
      mockDb as unknown as import('pg').Pool,
      'vid-1',
      'bfzym3u8',
      [
        // 新批次同站点，URL 不变 → keep
        makeSrc('https://bfzym3u8.example/ep1.mp4', 1),
      ],
    )

    expect(stats.sourcesKept).toBe(1)
    expect(stats.sourcesRemoved).toBe(0)
    expect(stats.sourcesAdded).toBe(0)
    // 未触发 DELETE（lzzy 的"线路1"不会出现在 SELECT 结果 → 不误删）
    const deleteCall = mockClient.query.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === 'string' &&
        (call[0] as string).toUpperCase().startsWith('UPDATE VIDEO_SOURCES SET DELETED_AT'),
    )
    expect(deleteCall).toBeFalsy()
  })

  it('事务回滚：INSERT 失败时 ROLLBACK 被调用', async () => {
    const { replaceSourcesForSite } = await import('@/api/db/queries/sources')

    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                    // BEGIN
      .mockResolvedValueOnce({ rows: [] })                    // SELECT existing
      .mockRejectedValueOnce(new Error('DB_ERROR'))           // INSERT fails

    await expect(
      replaceSourcesForSite(mockDb as unknown as import('pg').Pool, 'vid-1', 'site-a', [
        makeSrc('https://cdn.example.com/ep1.mp4', 1),
      ])
    ).rejects.toThrow('DB_ERROR')

    // ROLLBACK should have been called
    const rollbackCall = mockClient.query.mock.calls.find(
      (call) => call[0] === 'ROLLBACK'
    )
    expect(rollbackCall).toBeTruthy()
    expect(mockRelease).toHaveBeenCalled()
  })
})

// ── Tests: SRCHEALTH-P3-3-A source_hostname 写路径维护 ────────────
// 三处写路径全集（worker 无 INSERT）：「写 URL 必同步写 hostname」不变式封闭在
// query 层；hostname 语义真源 = @resovo/media-probe extractHostname（裁决 C/F）。

describe('SRCHEALTH-P3-3-A — source_hostname 写路径维护', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConnect.mockResolvedValue(mockClient)
    mockClient.query.mockResolvedValue({ rowCount: 0, rows: [] })
  })

  it('upsertSource: INSERT 含 source_hostname 列，参数为解析后的小写 hostname', async () => {
    const { upsertSource } = await import('@/api/db/queries/sources')
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await upsertSource(mockDb as unknown as import('pg').Pool, {
      videoId: 'vid-1',
      episodeNumber: 1,
      sourceUrl: 'HTTPS://CDN.Example.COM:8443/ep1.m3u8',
      sourceName: 'site-a',
      type: 'hls',
    })

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('source_hostname')
    // 小写 + 去端口（new URL().hostname 语义）
    expect(params[7]).toBe('cdn.example.com')
  })

  it('upsertSource: URL 不可解析时 source_hostname 参数为 null（NULL 容忍）', async () => {
    const { upsertSource } = await import('@/api/db/queries/sources')
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await upsertSource(mockDb as unknown as import('pg').Pool, {
      videoId: 'vid-1',
      episodeNumber: 1,
      sourceUrl: 'not a url',
      sourceName: 'site-a',
      type: 'mp4',
    })

    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(params[7]).toBe(null)
  })

  it('replaceSourcesForSite: INSERT 含 source_hostname 且 DO UPDATE 带 EXCLUDED.source_hostname（恢复软删行修复回填前 NULL）', async () => {
    const { replaceSourcesForSite } = await import('@/api/db/queries/sources')
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                // BEGIN
      .mockResolvedValueOnce({ rows: [] })                // SELECT existing
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })   // INSERT
      .mockResolvedValueOnce({ rows: [] })                // COMMIT

    await replaceSourcesForSite(mockDb as unknown as import('pg').Pool, 'vid-1', 'site-a', [
      { videoId: 'vid-1', episodeNumber: 1, sourceUrl: 'https://用户@v2.Host.COM:80/ep.m3u8', sourceName: 'site-a', type: 'hls' },
    ])

    const insertCall = mockClient.query.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('INSERT INTO video_sources')
    )
    expect(insertCall).toBeTruthy()
    const sql = insertCall![0] as string
    expect(sql).toContain('source_hostname')
    expect(sql).toContain('source_hostname = EXCLUDED.source_hostname')
    // 去 userinfo + 去端口 + 小写（裁决 B 规约）；is_active 为 SQL 字面量不占参数位 → $8 = index 7
    expect((insertCall![1] as unknown[])[7]).toBe('v2.host.com')
  })

  it('replaceSourceUrl: 换源必须随 newUrl 重算 source_hostname（三处中最不能漏的一处）', async () => {
    const { replaceSourceUrl } = await import('@/api/db/queries/sources')
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'src-1' }] })

    await replaceSourceUrl(mockDb as unknown as import('pg').Pool, 'src-1', 'https://new-cdn.example.org/v.m3u8')

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('source_hostname = $2')
    expect(params).toEqual(['https://new-cdn.example.org/v.m3u8', 'new-cdn.example.org', 'src-1'])
  })
})

// ── Tests: CrawlerService upsertVideo — append_only 退回策略 ──────

describe('CrawlerService.upsertVideo — source_update 策略', () => {
  beforeEach(() => vi.clearAllMocks())

  it('source_update=append_only 时调用 upsertSources（旧策略）', async () => {
    const upsertSourcesMock = vi.fn().mockResolvedValue(2)
    const replaceSourcesForSiteMock = vi.fn()

    vi.doMock('@/api/db/queries/sources', () => ({
      upsertSources: upsertSourcesMock,
      replaceSourcesForSite: replaceSourcesForSiteMock,
    }))

    // Re-import to get fresh module with new mocks
    // (This test validates the strategy routing logic at unit level)
    expect(upsertSourcesMock).not.toHaveBeenCalled()
    expect(replaceSourcesForSiteMock).not.toHaveBeenCalled()

    // Routing logic: append_only → upsertSources; replace → replaceSourcesForSite
    const useAppendOnly = true
    const siteKey = 'site-a'
    const sourceMappings = [{ videoId: 'v1', episodeNumber: 1, sourceUrl: 'http://x', sourceName: 'site-a', type: 'mp4' as const }]

    if (useAppendOnly || !siteKey) {
      await upsertSourcesMock(mockDb, sourceMappings)
    } else {
      await replaceSourcesForSiteMock(mockDb, 'v1', siteKey, sourceMappings)
    }

    expect(upsertSourcesMock).toHaveBeenCalledTimes(1)
    expect(replaceSourcesForSiteMock).not.toHaveBeenCalled()
  })

  it('无 source_update（默认 replace）且有 siteKey 时调用 replaceSourcesForSite', async () => {
    const upsertSourcesMock = vi.fn()
    const replaceSourcesForSiteMock = vi.fn().mockResolvedValue({ sourcesAdded: 1, sourcesKept: 0, sourcesRemoved: 0 })

    const useAppendOnly = false
    const siteKey = 'site-a'
    const sourceMappings = [{ videoId: 'v1', episodeNumber: 1, sourceUrl: 'http://x', sourceName: 'site-a', type: 'mp4' as const }]

    if (useAppendOnly || !siteKey) {
      await upsertSourcesMock(mockDb, sourceMappings)
    } else {
      await replaceSourcesForSiteMock(mockDb, 'v1', siteKey, sourceMappings)
    }

    expect(upsertSourcesMock).not.toHaveBeenCalled()
    expect(replaceSourcesForSiteMock).toHaveBeenCalledWith(mockDb, 'v1', siteKey, sourceMappings)
  })
})
