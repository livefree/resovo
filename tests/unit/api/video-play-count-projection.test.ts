/**
 * video-play-count-projection.test.ts — STATS-05-A 公共读模型 playCount 投影/映射
 *
 * 验证 ADR-216 STATS-05-A：VIDEO_JOIN 左连 video_play_totals + VIDEO_FULL_SELECT COALESCE(0)
 * + mapVideoRow / mapVideoCard 映射 play_count → playCount（缺失/无统计 → 0 容错）。
 * SQL 真实 COALESCE 数值由 VIDEO e2e / 合并期验证；本层验证投影常量形状 + mapper 纯函数映射。
 */

import { describe, it, expect } from 'vitest'
import {
  mapVideoRow,
  mapVideoCard,
  VIDEO_JOIN,
  VIDEO_FULL_SELECT,
  type DbVideoRow,
} from '@/api/db/queries/videos.internal'

// 最小 DbVideoRow（mapVideoRow/mapVideoCard 容错字段以 ?? 兜底；play_count 留待各用例 override）
const BASE_ROW = {
  id: 'v0000000-0000-0000-0000-000000000001',
  short_id: 'abc12345',
  slug: null,
  title: '测试电影',
  type: 'movie',
  catalog_id: 'c1',
  episode_count: 1,
  is_published: true,
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-01T00:00:00Z',
  source_content_type: null,
  normalized_type: null,
  content_format: null,
  episode_pattern: null,
  review_status: 'approved',
  visibility_status: 'public',
  needs_manual_review: false,
  content_rating: 'general',
  site_key: null,
  source_category: null,
  douban_status: 'pending',
  source_check_status: 'pending',
  meta_score: 0,
  trending_tag: null,
  title_en: null,
  title_original: null,
  description: null,
  cover_url: null,
  rating: 8.5,
  rating_votes: 100,
  runtime_minutes: null,
  year: 2024,
  country: null,
  status: 'completed',
  director: [],
  cast: [],
  writers: [],
  genres: [],
  aliases: [],
  languages: [],
  tags: [],
  douban_id: null,
  imdb_id: null,
  tmdb_id: null,
  title_normalized: 'test',
  metadata_source: 'manual',
  poster_blurhash: null,
  poster_status: null,
  backdrop_blurhash: null,
  backdrop_status: null,
  logo_url: null,
  logo_status: null,
  source_count: '2',
  subtitle_langs: [],
}

function row(playCount?: string): DbVideoRow {
  return (playCount === undefined ? { ...BASE_ROW } : { ...BASE_ROW, play_count: playCount }) as DbVideoRow
}

describe('STATS-05-A 播放次数读模型投影', () => {
  // ── 投影常量形状 ──────────────────────────────────────────────────
  it('VIDEO_JOIN 左连 video_play_totals（additive，按 video_id）', () => {
    expect(VIDEO_JOIN).toContain('LEFT JOIN video_play_totals vpt ON vpt.video_id = v.id')
  })

  it('VIDEO_FULL_SELECT 投影 COALESCE(total_play_count, 0) AS play_count（无统计行 → 0）', () => {
    expect(VIDEO_FULL_SELECT).toContain('COALESCE(vpt.total_play_count, 0) AS play_count')
  })

  // ── mapVideoRow 映射 ──────────────────────────────────────────────
  it('mapVideoRow：play_count 字符串 → playCount 数值', () => {
    expect(mapVideoRow(row('12345')).playCount).toBe(12345)
  })

  it('mapVideoRow：play_count=0 → 0', () => {
    expect(mapVideoRow(row('0')).playCount).toBe(0)
  })

  it('mapVideoRow：play_count 缺失 → 0（容错，无统计行不报错）', () => {
    expect(mapVideoRow(row()).playCount).toBe(0)
  })

  // ── mapVideoCard 映射 ─────────────────────────────────────────────
  it('mapVideoCard：play_count 字符串 → playCount 数值', () => {
    expect(mapVideoCard(row('999')).playCount).toBe(999)
  })

  it('mapVideoCard：play_count 缺失 → 0（卡片无统计显示 0 / 前台不渲染）', () => {
    expect(mapVideoCard(row()).playCount).toBe(0)
  })
})
