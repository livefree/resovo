-- 051_add_videos_trending_tag.sql
-- 描述：videos 表新增 trending_tag 列（热门/周榜/编辑精选/独家），前台榜单专用
-- 日期：2026-04-22
-- ADR：ADR-052（home_modules top10 配套）
-- 幂等：是（ADD COLUMN IF NOT EXISTS / DO 幂等约束块 / CREATE INDEX IF NOT EXISTS）
--
-- ⚠️  Down 路径保持注释形式（同 049/050 约定）
-- ⚠️  本 migration 在事务内执行，故索引未使用 CONCURRENTLY。
--     生产环境若 videos 表行数 > 百万且期望零锁变更，请手动在事务外执行：
--       CREATE INDEX CONCURRENTLY IF NOT EXISTS videos_trending_tag_idx
--         ON videos (trending_tag) WHERE trending_tag IS NOT NULL;

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS trending_tag TEXT NULL;

-- 幂等追加约束（ADD CONSTRAINT IF NOT EXISTS 不支持，用 DO 块保护）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'videos_trending_tag_check'
  ) THEN
    ALTER TABLE videos
      ADD CONSTRAINT videos_trending_tag_check
      CHECK (trending_tag IS NULL OR trending_tag IN ('hot', 'weekly_top', 'editors_pick', 'exclusive'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS videos_trending_tag_idx
  ON videos (trending_tag)
  WHERE trending_tag IS NOT NULL;

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- DROP INDEX IF EXISTS videos_trending_tag_idx;
-- ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_trending_tag_check;
-- ALTER TABLE videos DROP COLUMN IF EXISTS trending_tag;
-- COMMIT;
