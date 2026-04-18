-- 019_rebuild_video_type_genre.sql
-- 描述：VideoType/VideoGenre 命名重建
--   - videos.category 列重命名为 source_category（保留爬虫原始分类字符串）
--   - 新增 videos.genre 列（平台策展题材，VideoGenre 枚举，初始为 NULL）
--   - videos.type 值域从旧 12 种更新为新 11 种
--   - 重建 videos_type_check 与 videos_genre_check 约束
-- 日期：2026-03
-- 依赖：013_type_expansion（必须先存在 videos_type_check 约束）
-- 幂等：是（IF EXISTS / IF NOT EXISTS 保护所有 DDL）

BEGIN;

-- ── 1. 重命名 category → source_category（保留爬虫原始值）────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'category'
  ) THEN
    ALTER TABLE videos RENAME COLUMN category TO source_category;
  END IF;
END $$;

-- ── 2. 新增 genre 列（平台策展题材，初始为 NULL）──────────────────

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS genre TEXT;

-- ── 3. 删除旧 type CHECK 约束 ─────────────────────────────────────

ALTER TABLE videos
  DROP CONSTRAINT IF EXISTS videos_type_check;

-- ── 4. 数据迁移：旧 type 值 → 新 type 值 ─────────────────────────

UPDATE videos SET type = 'series'   WHERE type = 'drama';
UPDATE videos SET type = 'short'    WHERE type = 'short_drama';
UPDATE videos SET type = 'kids'     WHERE type = 'children';
UPDATE videos SET type = 'variety'  WHERE type = 'game_show';
-- 'documentary' 保留（含义从题材改为内容形式，同名）

-- ── 5. 添加新 type CHECK 约束（11 种内容形式）────────────────────

ALTER TABLE videos
  ADD CONSTRAINT videos_type_check
    CHECK (type IN (
      'movie',
      'series',
      'anime',
      'variety',
      'documentary',
      'short',
      'sports',
      'music',
      'news',
      'kids',
      'other'
    ));

-- ── 6. 添加 genre CHECK 约束（15 种内容题材）─────────────────────

ALTER TABLE videos
  DROP CONSTRAINT IF EXISTS videos_genre_check;

ALTER TABLE videos
  ADD CONSTRAINT videos_genre_check
    CHECK (genre IS NULL OR genre IN (
      'action',
      'comedy',
      'romance',
      'thriller',
      'horror',
      'sci_fi',
      'fantasy',
      'history',
      'crime',
      'mystery',
      'war',
      'family',
      'biography',
      'martial_arts',
      'other'
    ));

COMMIT;
