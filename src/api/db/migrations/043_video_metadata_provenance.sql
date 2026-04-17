-- 描述：新建 video_metadata_provenance 表，追踪 media_catalog 每个字段的最后写入来源
-- 日期：2026-04-17
-- 幂等：是（使用 IF NOT EXISTS）

CREATE TABLE IF NOT EXISTS video_metadata_provenance (
  catalog_id   UUID        NOT NULL REFERENCES media_catalog(id) ON DELETE CASCADE,
  field_name   TEXT        NOT NULL,
  source_kind  TEXT        NOT NULL,  -- 'manual' | 'douban' | 'bangumi' | 'tmdb' | 'crawler'
  source_ref   TEXT,                  -- 外部 ID，如豆瓣条目 ID
  source_priority INT      NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (catalog_id, field_name)
);

CREATE INDEX IF NOT EXISTS idx_video_metadata_provenance_catalog
  ON video_metadata_provenance (catalog_id);
