-- 036_external_data_schema.sql
-- CHG-384: 创建 external_data schema，供 MetadataEnrichService 做本地毫秒级标题匹配
-- 用途：不同于 external_*_raw 原始暂存表，本 schema 存储干净的、已标准化的查询专用数据
-- 幂等：可重复执行

BEGIN;

CREATE SCHEMA IF NOT EXISTS external_data;

-- ── Douban 条目查询表 ────────────────────────────────────────────────
-- 来源：external-db/douban/moviedata-10m/movies.csv（约 14 万行）
-- 导入脚本：scripts/import-douban-dump.ts

CREATE TABLE IF NOT EXISTS external_data.douban_entries (
  id               BIGSERIAL     PRIMARY KEY,
  douban_id        TEXT          NOT NULL,
  title            TEXT          NOT NULL,
  title_normalized TEXT          NOT NULL,
  year             INT,
  media_type       TEXT,
  rating           NUMERIC(4,1),
  description      TEXT,
  cover_url        TEXT,
  directors        TEXT[]        NOT NULL DEFAULT '{}',
  cast             TEXT[]        NOT NULL DEFAULT '{}',
  writers          TEXT[]        NOT NULL DEFAULT '{}',
  genres           TEXT[]        NOT NULL DEFAULT '{}',
  country          TEXT,
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_external_douban_id
  ON external_data.douban_entries (douban_id);

-- MetadataEnrichService Step1：按 title_normalized + year 精确匹配
CREATE INDEX IF NOT EXISTS idx_external_douban_title_year
  ON external_data.douban_entries (title_normalized, year);

-- ── Bangumi 条目查询表 ────────────────────────────────────────────────
-- 来源：external-db/bangumi/…/subject.jsonlines（仅 type=2 动画，约 1 万行）
-- 导入脚本：scripts/import-bangumi-dump.ts

CREATE TABLE IF NOT EXISTS external_data.bangumi_entries (
  id               BIGSERIAL     PRIMARY KEY,
  bangumi_id       INT           NOT NULL,
  title_cn         TEXT,
  title_jp         TEXT,
  title_normalized TEXT          NOT NULL,
  air_date         TEXT,
  year             INT,
  rating           NUMERIC(4,1),
  episode_count    INT,
  summary          TEXT,
  cover_url        TEXT,
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_external_bangumi_id
  ON external_data.bangumi_entries (bangumi_id);

-- MetadataEnrichService Step3：按 title_normalized + year 匹配动画
CREATE INDEX IF NOT EXISTS idx_external_bangumi_title_year
  ON external_data.bangumi_entries (title_normalized, year);

-- ── 验证 ──────────────────────────────────────────────────────────────

DO $$
DECLARE
  d_cols INT;
  b_cols INT;
BEGIN
  SELECT COUNT(*) INTO d_cols
  FROM information_schema.columns
  WHERE table_schema = 'external_data' AND table_name = 'douban_entries'
    AND column_name IN ('douban_id', 'title_normalized', 'year', 'directors', 'cast', 'genres');

  SELECT COUNT(*) INTO b_cols
  FROM information_schema.columns
  WHERE table_schema = 'external_data' AND table_name = 'bangumi_entries'
    AND column_name IN ('bangumi_id', 'title_cn', 'title_jp', 'title_normalized', 'air_date', 'year');

  IF d_cols < 6 THEN
    RAISE EXCEPTION 'Migration 036: external_data.douban_entries 字段缺失，期望 6，实际 %', d_cols;
  END IF;

  IF b_cols < 6 THEN
    RAISE EXCEPTION 'Migration 036: external_data.bangumi_entries 字段缺失，期望 6，实际 %', b_cols;
  END IF;

  RAISE NOTICE 'Migration 036 OK: external_data.douban_entries + bangumi_entries 已创建';
END $$;

COMMIT;
