/**
 * tests/unit/api/titleObservations.test.ts — SEQ-20260602-03 / CHG-VIR-6（Phase 1b）
 *
 * 覆盖 DB query 层 recordTitleObservation：INSERT ... ON CONFLICT(去重键) DO UPDATE observed_count+1
 * （去重聚合 / 设计 §1b：重复标题只增 observed_count，不参与归并决策）。
 * 注：原始标题→入参的解析/哈希组装在 Service 层（CrawlerService.buildTitleObservation），
 * 端到端覆盖见 crawlerTitleObservation.test.ts。
 */

import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import { recordTitleObservation } from '@/api/db/queries/titleObservations'

describe('recordTitleObservation — ON CONFLICT 去重聚合 upsert', () => {
  it('INSERT title_observations + ON CONFLICT 去重键 + DO UPDATE observed_count+1', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [] })
    const db = { query: queryMock } as unknown as Pool

    await recordTitleObservation(db, {
      videoId: 'vid-1',
      sourceSiteKey: 'site-a',
      sourceName: null,
      rawTitle: '某剧',
      rawTitleHash: 'hash-1',
      parserVersion: '1.0.0',
      parsedFacets: { coreTitleKey: '某剧', titleKind: 'original', confidence: 1, facets: {} },
    })

    const sql = queryMock.mock.calls[0]![0] as string
    expect(sql).toContain('INSERT INTO title_observations')
    expect(sql).toContain('ON CONFLICT')
    // 去重键须复述 COALESCE 表达式（与 migration 085 唯一索引一致）
    expect(sql).toContain("COALESCE(source_site_key, '')")
    expect(sql).toContain("COALESCE(source_name, '')")
    expect(sql).toContain('raw_title_hash')
    expect(sql).toContain('parser_version')
    // 去重聚合：命中 +1，刷新 last_seen_at
    expect(sql).toContain('observed_count      = title_observations.observed_count + 1')
    expect(sql).toContain('last_seen_at        = NOW()')
  })

  it('参数顺序与列集对应，facets 经 JSON.stringify', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [] })
    const db = { query: queryMock } as unknown as Pool

    await recordTitleObservation(db, {
      videoId: 'vid-2',
      sourceSiteKey: null,
      sourceName: null,
      rawTitle: 'T',
      rawTitleHash: 'h2',
      parserVersion: '1.0.0',
      parsedFacets: { coreTitleKey: 't', titleKind: 'original', confidence: 1, facets: {} },
    })

    const params = queryMock.mock.calls[0]![1] as unknown[]
    expect(params[0]).toBe('vid-2')
    expect(params[1]).toBeNull()  // source_site_key（COALESCE 在 SQL 内处理）
    expect(params[2]).toBeNull()  // source_name
    expect(params[3]).toBe('T')
    expect(params[4]).toBe('h2')
    expect(params[5]).toBe('1.0.0')
    expect(typeof params[6]).toBe('string') // parsed_facets_jsonb JSON.stringify
    expect(JSON.parse(params[6] as string)).toMatchObject({ coreTitleKey: 't' })
  })

  it('parsed_facets_jsonb 经 $7::jsonb 写入', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [] })
    const db = { query: queryMock } as unknown as Pool
    await recordTitleObservation(db, {
      videoId: 'v', sourceSiteKey: null, sourceName: null, rawTitle: 'x',
      rawTitleHash: 'h', parserVersion: '1.0.0', parsedFacets: {},
    })
    expect(queryMock.mock.calls[0]![0] as string).toContain('$7::jsonb')
  })
})
