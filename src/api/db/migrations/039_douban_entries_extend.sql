-- 039_douban_entries_extend.sql
-- META-01: 补全 external_data.douban_entries 缺失字段
-- 来源：external-db/douban/moviedata-10m/movies.csv 全部 21 列均已在
--       external_douban_movies_raw 中保存，本次将其同步至查询优化层
-- 幂等：ADD COLUMN IF NOT EXISTS，可重复执行

BEGIN;

ALTER TABLE external_data.douban_entries
  ADD COLUMN IF NOT EXISTS aliases          TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS imdb_id          TEXT,
  ADD COLUMN IF NOT EXISTS languages        TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS duration_minutes INT,
  ADD COLUMN IF NOT EXISTS tags             TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS douban_votes     INT,
  ADD COLUMN IF NOT EXISTS regions          TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS release_date     TEXT,
  ADD COLUMN IF NOT EXISTS actor_ids        TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS director_ids     TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS official_site    TEXT;

-- imdb_id 查询索引（META-05 alias/imdb 精确匹配用）
CREATE INDEX IF NOT EXISTS idx_external_douban_imdb_id
  ON external_data.douban_entries (imdb_id)
  WHERE imdb_id IS NOT NULL AND imdb_id != '';

-- ── 验证 ──────────────────────────────────────────────────────────────

DO $$
DECLARE
  new_cols INT;
BEGIN
  SELECT COUNT(*) INTO new_cols
  FROM information_schema.columns
  WHERE table_schema = 'external_data' AND table_name = 'douban_entries'
    AND column_name IN (
      'aliases', 'imdb_id', 'languages', 'duration_minutes', 'tags',
      'douban_votes', 'regions', 'release_date', 'actor_ids', 'director_ids', 'official_site'
    );

  IF new_cols < 11 THEN
    RAISE EXCEPTION 'Migration 039: external_data.douban_entries 新字段缺失，期望 11，实际 %', new_cols;
  END IF;

  RAISE NOTICE 'Migration 039 OK: external_data.douban_entries 补全 11 个字段';
END $$;

COMMIT;
