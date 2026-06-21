/**
 * admin-image-health.test.ts — /admin/image-health/* SQL 真实执行集成测试
 * （CHG-SN-6-02 / 5 项硬清单第 4 项 schema 三层防护）
 *
 * 范围：
 *   - getImageHealthStats（JOIN media_catalog poster_status / backdrop_status）
 *   - getTopBrokenDomains（regexp_replace + GROUP BY domain）
 *   - listMissingPosterVideos（JOIN media_catalog + sortField 3 类）
 *   - getBrokenEventsTrend（按天聚合）
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'
import { createIntegrationPool } from '../../helpers/integration-pg'

import {
  getImageHealthStats,
  getTopBrokenDomains,
  listMissingPosterVideos,
  getBrokenEventsTrend,
  getProblemImages,
  getProblemImageCounts,
} from '../../../apps/api/src/db/queries/imageHealth'

let db: Pool

beforeAll(() => {
  db = createIntegrationPool()
})

afterAll(async () => {
  await db.end()
})

describe('getImageHealthStats SQL 集成', () => {
  it('JOIN media_catalog 计算双口径（已发布/全部）4 类图片 ok 数跑通', async () => {
    const stats = await getImageHealthStats(db)
    expect(stats).toHaveProperty('published')
    expect(stats).toHaveProperty('all')
    expect(stats).toHaveProperty('brokenLast7Days')
    // 两口径各字段非负 + ok ≤ videoCount（不可能正常图片多于视频数）
    for (const scope of [stats.published, stats.all]) {
      expect(scope.videoCount).toBeGreaterThanOrEqual(0)
      for (const ok of [scope.posterOk, scope.backdropOk, scope.logoOk, scope.bannerOk]) {
        expect(ok).toBeGreaterThanOrEqual(0)
        expect(ok).toBeLessThanOrEqual(scope.videoCount)
      }
    }
    // 已发布是全部的子集
    expect(stats.published.videoCount).toBeLessThanOrEqual(stats.all.videoCount)
    expect(stats.brokenLast7Days).toBeGreaterThanOrEqual(0)
  })

  it('videoCount = 0 时各 ok 计数为 0（空库不报错、消费方按 ok/count 现算覆盖率不除零）', async () => {
    const stats = await getImageHealthStats(db)
    for (const scope of [stats.published, stats.all]) {
      if (scope.videoCount === 0) {
        expect(scope.posterOk).toBe(0)
        expect(scope.backdropOk).toBe(0)
        expect(scope.logoOk).toBe(0)
        expect(scope.bannerOk).toBe(0)
      }
    }
  })
})

describe('getProblemImages / getProblemImageCounts SQL 集成（ADR-211 / 4A arch-reviewer 风险 3）', () => {
  const REASON_RANK: Record<string, number> = {
    broken_event: 1, broken: 2, low_quality: 3, pending_review: 4, other: 5,
  }

  it('getProblemImageCounts 返回 4 类非负计数', async () => {
    const counts = await getProblemImageCounts(db, 'published')
    for (const k of ['poster', 'backdrop', 'logo', 'banner_backdrop'] as const) {
      expect(typeof counts[k]).toBe('number')
      expect(counts[k]).toBeGreaterThanOrEqual(0)
    }
  })

  it('getProblemImages(poster,published) 跑通：url 非空守卫 + problemReason 合法 + 优先级非递减排序', async () => {
    const rows = await getProblemImages(db, 'poster', 'published', 0, 48)
    expect(rows).toBeInstanceOf(Array)
    expect(rows.length).toBeLessThanOrEqual(48)
    let prevRank = 0
    for (const r of rows) {
      // D-211-2 url-guard：imageUrl 恒非空非空白
      expect(typeof r.imageUrl).toBe('string')
      expect(r.imageUrl.trim().length).toBeGreaterThan(0)
      // problemReason ∈ 合法集
      expect(REASON_RANK[r.problemReason]).toBeDefined()
      // Codex H-2 默认排序：reason 优先级非递减（broken_event 在前）
      expect(REASON_RANK[r.problemReason]).toBeGreaterThanOrEqual(prevRank)
      prevRank = REASON_RANK[r.problemReason]
      // broken_event 行必带事件信息
      if (r.problemReason === 'broken_event') expect(r.eventType).not.toBeNull()
    }
  })

  it('total=counts[kind] 一致：limit 超量时 page 行数 === 当前 kind 计数', async () => {
    const counts = await getProblemImageCounts(db, 'published')
    const rows = await getProblemImages(db, 'poster', 'published', 0, 100000)
    expect(rows.length).toBe(Math.min(100000, counts.poster))
  })
})

describe('getTopBrokenDomains SQL 集成', () => {
  it('regexp_replace 提取 domain + GROUP BY 跑通（默认 limit 10）', async () => {
    const rows = await getTopBrokenDomains(db)
    expect(rows).toBeInstanceOf(Array)
    for (const row of rows) {
      expect(row).toHaveProperty('domain')
      expect(row).toHaveProperty('eventCount')
      expect(row).toHaveProperty('affectedVideos')
      expect(typeof row.eventCount).toBe('number')
      expect(typeof row.affectedVideos).toBe('number')
    }
  })

  it('limit=20 自定义跑通', async () => {
    const rows = await getTopBrokenDomains(db, 20)
    expect(rows).toBeInstanceOf(Array)
    expect(rows.length).toBeLessThanOrEqual(20)
  })
})

describe('listMissingPosterVideos SQL 集成（JOIN media_catalog）', () => {
  it('默认排序 created_at DESC 跑通', async () => {
    const rows = await listMissingPosterVideos(db, 20, 0, 'created_at', 'desc')
    expect(rows).toBeInstanceOf(Array)
    for (const row of rows) {
      expect(row).toHaveProperty('videoId')
      expect(row).toHaveProperty('title')
      expect(row).toHaveProperty('posterStatus')
      expect(['missing', 'broken', 'pending_review']).toContain(row.posterStatus)
    }
  })

  it('sortField=title ASC 跑通（mc.poster_status 过滤 + v.title 排序）', async () => {
    const rows = await listMissingPosterVideos(db, 20, 0, 'title', 'asc')
    expect(rows).toBeInstanceOf(Array)
  })

  it('sortField=poster_status DESC 跑通', async () => {
    const rows = await listMissingPosterVideos(db, 20, 0, 'poster_status', 'desc')
    expect(rows).toBeInstanceOf(Array)
  })

  it('分页 offset 跑通', async () => {
    const rows = await listMissingPosterVideos(db, 10, 100, 'created_at', 'desc')
    expect(rows).toBeInstanceOf(Array)
    expect(rows.length).toBeLessThanOrEqual(10)
  })
})

describe('getBrokenEventsTrend SQL 集成', () => {
  it('7 天趋势聚合跑通', async () => {
    const trend = await getBrokenEventsTrend(db, 7)
    expect(trend).toBeInstanceOf(Array)
    expect(trend.length).toBe(7)
    for (const row of trend) {
      expect(row).toHaveProperty('date')
      expect(row).toHaveProperty('count')
      expect(typeof row.count).toBe('number')
    }
  })
})
