-- Migration 042: media_catalog 字段扩展
-- META-06: 新增 aliases / languages / official_site / tags / backdrop_url / trailer_url
-- 其余字段（imdb_id / rating_votes / release_date / title_original / runtime_minutes）Migration 026 已存在

ALTER TABLE media_catalog
  ADD COLUMN IF NOT EXISTS aliases        TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS languages      TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS official_site  TEXT,
  ADD COLUMN IF NOT EXISTS tags           TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS backdrop_url   TEXT,
  ADD COLUMN IF NOT EXISTS trailer_url    TEXT;

COMMENT ON COLUMN media_catalog.aliases       IS '别名/又名列表，来自外部元数据（如豆瓣 aliases[]）';
COMMENT ON COLUMN media_catalog.languages     IS '语言列表（如["普通话","粤语"]）';
COMMENT ON COLUMN media_catalog.official_site IS '官网 URL';
COMMENT ON COLUMN media_catalog.tags          IS '标签列表（如豆瓣 tags[]）';
COMMENT ON COLUMN media_catalog.backdrop_url  IS '横幅/背景图 URL';
COMMENT ON COLUMN media_catalog.trailer_url   IS '预告片 URL';
