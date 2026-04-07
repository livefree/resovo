-- 031_genre_to_genres.sql
-- CHG-376: 将 media_catalog.genre（单值枚举 TEXT）改为 genres（多值 TEXT[]）
-- 支持一部作品同时归属多种题材
-- 幂等：可重复执行

BEGIN;

-- ── Step 1: 新增 genres 列 ────────────────────────────────────────

ALTER TABLE media_catalog
  ADD COLUMN IF NOT EXISTS genres TEXT[] NOT NULL DEFAULT '{}';

-- ── Step 2: 从现有 genre 列回填 ──────────────────────────────────

UPDATE media_catalog
SET genres = ARRAY[genre]
WHERE genre IS NOT NULL
  AND genres = '{}';

-- ── Step 3: 建 GIN 索引（支持 @> 数组包含查询）──────────────────

CREATE INDEX IF NOT EXISTS idx_catalog_genres
  ON media_catalog USING GIN (genres);

-- ── Step 4: 删除旧 genre 单值列 ──────────────────────────────────
-- （CHECK 约束随列自动删除）

ALTER TABLE media_catalog
  DROP COLUMN IF EXISTS genre;

-- ── 验证 ─────────────────────────────────────────────────────────

DO $$
DECLARE
  total_rows      INT;
  with_genres     INT;
  without_genres  INT;
BEGIN
  SELECT COUNT(*) INTO total_rows    FROM media_catalog;
  SELECT COUNT(*) INTO with_genres   FROM media_catalog WHERE genres != '{}';
  without_genres := total_rows - with_genres;

  RAISE NOTICE 'Migration 031: total=%, with_genres=%, without_genres=%',
    total_rows, with_genres, without_genres;

  IF without_genres > 0 THEN
    RAISE NOTICE '% catalog entries have no genres (normal if source_category was empty)', without_genres;
  END IF;
END $$;

COMMIT;
