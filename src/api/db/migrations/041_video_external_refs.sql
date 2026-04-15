-- 041_video_external_refs.sql
-- META-03: 建立内外部元数据关联表
-- 用途：记录"哪个内部视频匹配了哪个外部条目"，支持自动/人工确认、置信度追踪
-- 命名参考：docs/external_metadata_import_plan_20260405.md（video_external_refs）
-- 幂等：可重复执行

BEGIN;

CREATE TABLE IF NOT EXISTS video_external_refs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id         UUID        NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  provider         TEXT        NOT NULL
                   CHECK (provider IN ('douban', 'tmdb', 'bangumi', 'imdb')),
  external_id      TEXT        NOT NULL,    -- provider 侧 ID（如豆瓣 MOVIE_ID）
  match_status     TEXT        NOT NULL DEFAULT 'candidate'
                   CHECK (match_status IN ('auto_matched', 'manual_confirmed', 'candidate', 'rejected')),
  match_method     TEXT,                    -- 匹配方式：title_year_type / imdb_id / alias_year / manual
  confidence       NUMERIC(4,2),            -- 0.00–1.00
  is_primary       BOOLEAN     NOT NULL DEFAULT false,  -- 该视频在此 provider 的主要绑定
  linked_by        TEXT,                    -- 触发匹配的来源：auto / moderator / admin / import
  linked_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes            TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 每个视频每个 provider 只允许一个 primary 绑定
CREATE UNIQUE INDEX IF NOT EXISTS uq_video_external_refs_primary
  ON video_external_refs (video_id, provider)
  WHERE is_primary = true;

-- 按 video_id 快速查询（MetadataEnrichService / 审核台常用路径）
CREATE INDEX IF NOT EXISTS idx_video_external_refs_video_id
  ON video_external_refs (video_id);

-- 按 provider + external_id 反向查询（检查是否已有视频绑定了同一外部条目）
CREATE INDEX IF NOT EXISTS idx_video_external_refs_provider_external
  ON video_external_refs (provider, external_id);

-- ── 验证 ──────────────────────────────────────────────────────────────

DO $$
DECLARE
  col_count INT;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'video_external_refs'
    AND column_name IN ('id', 'video_id', 'provider', 'external_id',
                        'match_status', 'confidence', 'is_primary');

  IF col_count < 7 THEN
    RAISE EXCEPTION 'Migration 041: video_external_refs 字段缺失，期望 7，实际 %', col_count;
  END IF;

  RAISE NOTICE 'Migration 041 OK: video_external_refs 已创建';
END $$;

COMMIT;
