-- 064_crawler_site_category_maps.sql
-- 描述：新建 crawler_site_category_maps — 站点级分类映射表
-- ADR：ADR-123（Crawler 站点行展开"分类映射"schema 设计）
-- 对应交付：CHG-SN-7-REDO-01-F
-- 幂等：可重复执行（IF NOT EXISTS + CREATE OR REPLACE）

BEGIN;

CREATE TABLE IF NOT EXISTS crawler_site_category_maps (
  site_key       VARCHAR(100)  NOT NULL
                               REFERENCES crawler_sites(key)
                               ON DELETE CASCADE,
  source_label   VARCHAR(200)  NOT NULL,
  target_genre   VARCHAR(30)   NOT NULL
                               CHECK (target_genre IN (
                                 'action', 'comedy', 'romance', 'thriller', 'horror',
                                 'sci_fi', 'fantasy', 'history', 'crime', 'mystery',
                                 'war', 'family', 'biography', 'martial_arts',
                                 'adventure', 'disaster', 'musical', 'western',
                                 'sport', 'other',
                                 '_unmapped', '_discard'
                               )),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  PRIMARY KEY (site_key, source_label)
);

COMMENT ON TABLE crawler_site_category_maps
  IS '站点级分类映射：source_label(站点原始分类) → target_genre(平台 VideoGenre)';
COMMENT ON COLUMN crawler_site_category_maps.source_label
  IS '站点 crawler scrape 得来的原始分类标签文本';
COMMENT ON COLUMN crawler_site_category_maps.target_genre
  IS '映射目标，复用 VideoGenre 枚举 + _unmapped/_discard 特殊值';

-- 按 site_key 查询所有映射（主键前缀已覆盖，无需额外索引）

-- updated_at trigger（与 home_modules / source_line_aliases 同模式）
CREATE OR REPLACE FUNCTION crawler_site_category_maps_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS crawler_site_category_maps_updated_at_trg
  ON crawler_site_category_maps;
CREATE TRIGGER crawler_site_category_maps_updated_at_trg
  BEFORE UPDATE ON crawler_site_category_maps
  FOR EACH ROW EXECUTE FUNCTION crawler_site_category_maps_set_updated_at();

DO $$
DECLARE
  table_count INT;
BEGIN
  SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name = 'crawler_site_category_maps';

  IF table_count < 1 THEN
    RAISE EXCEPTION 'Migration 064: crawler_site_category_maps 表不存在';
  END IF;

  RAISE NOTICE 'Migration 064 OK: crawler_site_category_maps 已建表';
END $$;

COMMIT;

-- ── ROLLBACK ──────────────────────────────────────────────────────
-- BEGIN;
-- DROP TRIGGER IF EXISTS crawler_site_category_maps_updated_at_trg
--   ON crawler_site_category_maps;
-- DROP FUNCTION IF EXISTS crawler_site_category_maps_set_updated_at();
-- DROP TABLE IF EXISTS crawler_site_category_maps;
-- COMMIT;
