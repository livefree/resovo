/**
 * tests/helpers/db.ts — 测试数据库工具
 * 提供测试数据的创建和清理函数，保证测试隔离
 */

import type { Pool } from 'pg'
import { makeUser, makeVideo, makeSource } from './factories'

// ── 清理（每个测试后调用）────────────────────────────────────────

/**
 * 清理所有测试数据（通过命名约定识别：email 含 @resovo.test，title 含 "测试"）
 * 注意：必须按外键依赖顺序删除
 */
export async function cleanTestData(db: Pool): Promise<void> {
  await db.query(`
    DELETE FROM danmaku      WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@resovo.test');
    DELETE FROM comments     WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@resovo.test');
    DELETE FROM list_items   WHERE list_id IN (SELECT id FROM lists WHERE title LIKE 'test_%');
    DELETE FROM list_likes   WHERE list_id IN (SELECT id FROM lists WHERE title LIKE 'test_%');
    DELETE FROM lists        WHERE title LIKE 'test_%';
    DELETE FROM user_favorites WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@resovo.test');
    DELETE FROM watch_history  WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@resovo.test');
    DELETE FROM video_sources  WHERE source_name LIKE 'test_%';
    DELETE FROM subtitles      WHERE video_id IN (SELECT id FROM videos WHERE title LIKE '测试%');
    DELETE FROM video_tags     WHERE video_id IN (SELECT id FROM videos WHERE title LIKE '测试%');
    DELETE FROM videos         WHERE title LIKE '测试%';
    DELETE FROM users          WHERE email LIKE '%@resovo.test';
  `)
}

// ── 数据库种子（集成测试用）──────────────────────────────────────

export async function seedTestUser(db: Pool, overrides?: Parameters<typeof makeUser>[0]) {
  const user = makeUser(overrides)
  const result = await db.query(
    `INSERT INTO users (id, username, email, password_hash, role, locale, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [user.id, user.username, user.email,
     '$2b$10$test.hash.placeholder', // bcrypt hash，测试用
     user.role, user.locale, user.createdAt]
  )
  return result.rows[0]
}

export async function seedTestVideo(db: Pool, overrides?: Parameters<typeof makeVideo>[0]) {
  const video = makeVideo(overrides)
  // videos.catalog_id 是 NOT NULL FK → media_catalog（VSR/VIR 重构后的规范父实体）。
  // 先 seed media_catalog（仅 NOT NULL：title / title_normalized / type），再 seed videos。
  // 旧实现引用的 title_en/status/rating/year/country/director/cast/writers 列已随重构退役，不再写入。
  const catalog = await db.query<{ id: string }>(
    `INSERT INTO media_catalog (title, title_normalized, type)
     VALUES ($1, $2, $3) RETURNING id`,
    [video.title, video.title.toLowerCase(), video.type]
  )
  const catalogId = catalog.rows[0].id
  const result = await db.query(
    `INSERT INTO videos (id, short_id, slug, title, type, episode_count, catalog_id, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [video.id, video.shortId, video.slug, video.title, video.type,
     video.episodeCount, catalogId, video.createdAt]
  )
  return result.rows[0]
}

export async function seedTestSource(db: Pool, videoId: string) {
  const source = makeSource(videoId)
  const result = await db.query(
    `INSERT INTO video_sources (id, video_id, source_url, source_name, quality, type, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [source.id, source.videoId, source.sourceUrl, source.sourceName,
     source.quality, source.type, source.isActive]
  )
  return result.rows[0]
}
