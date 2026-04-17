-- Migration 003: 添加豆瓣 ID 列（CHG-23 Douban 元数据同步）
-- 执行方式：psql $DATABASE_URL -f src/api/db/migrations/003_add_douban_id.sql

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS douban_id VARCHAR(20);
