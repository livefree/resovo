-- 007_video_merge.sql
-- 描述：视频归并策略 — 标题标准化字段、元数据来源追踪、视频别名表、播放源唯一约束更新
-- 日期：2026-03
-- 幂等：是（使用 IF NOT EXISTS / DO NOTHING）
-- CHG-38

-- ── videos 表：新增 title_normalized + metadata_source ──────────────

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS title_normalized  TEXT,
  ADD COLUMN IF NOT EXISTS metadata_source   VARCHAR(10) NOT NULL DEFAULT 'crawler'
    CHECK (metadata_source IN ('tmdb', 'douban', 'manual', 'crawler'));

-- 对现有行回填标准化标题（简单 lower，后续会由 TitleNormalizer 补全）
UPDATE videos
SET title_normalized = lower(title)
WHERE title_normalized IS NULL;

-- ── video_aliases 表 ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS video_aliases (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id   UUID        NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  alias      TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (video_id, alias)
);

CREATE INDEX IF NOT EXISTS idx_video_aliases_video_id
  ON video_aliases(video_id);

CREATE INDEX IF NOT EXISTS idx_video_aliases_alias
  ON video_aliases(alias);

-- ── videos 索引：按标准化 match_key 快速去重 ────────────────────────

CREATE INDEX IF NOT EXISTS idx_videos_title_normalized
  ON videos(title_normalized) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_videos_normalized_year_type
  ON videos(title_normalized, year, type) WHERE deleted_at IS NULL;

-- ── video_sources：更换唯一约束 ─────────────────────────────────────
-- 旧约束：(video_id, source_url)
-- 新约束：(video_id, episode_number, source_url) NULLS NOT DISTINCT
-- 原因：同一视频的同一集相同 URL 不重复插入；NULL episode_number 视为相同

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_sources_video_url'
      AND conrelid = 'video_sources'::regclass
  ) THEN
    ALTER TABLE video_sources DROP CONSTRAINT uq_sources_video_url;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_sources_video_episode_url'
      AND conrelid = 'video_sources'::regclass
  ) THEN
    ALTER TABLE video_sources ADD CONSTRAINT uq_sources_video_episode_url
      UNIQUE NULLS NOT DISTINCT (video_id, episode_number, source_url);
  END IF;
END $$;
