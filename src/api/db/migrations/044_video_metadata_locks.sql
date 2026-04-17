-- 描述：新建 video_metadata_locks 表，精细化字段级锁定（soft/hard）
-- 日期：2026-04-17
-- 幂等：是（使用 IF NOT EXISTS）

CREATE TABLE IF NOT EXISTS video_metadata_locks (
  catalog_id   UUID        NOT NULL REFERENCES media_catalog(id) ON DELETE CASCADE,
  field_name   TEXT        NOT NULL,
  lock_mode    TEXT        NOT NULL CHECK (lock_mode IN ('soft', 'hard')),
  locked_by    TEXT        NOT NULL,  -- user ID 或 'system'
  locked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason       TEXT,
  PRIMARY KEY (catalog_id, field_name)
);

CREATE INDEX IF NOT EXISTS idx_video_metadata_locks_catalog
  ON video_metadata_locks (catalog_id);
