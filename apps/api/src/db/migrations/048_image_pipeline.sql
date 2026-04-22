-- 048_image_pipeline.sql
-- 描述：图片治理字段扩展 + broken_image_events + video_episode_images 表
-- 日期：2026-04-20
-- ADR：ADR-046
-- 幂等：是（ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS）

-- ── 1. media_catalog 新增图片治理元数据字段 ────────────────────────

-- P0 竖封面治理（对应已有 cover_url）
ALTER TABLE media_catalog
  ADD COLUMN IF NOT EXISTS poster_blurhash       TEXT,
  ADD COLUMN IF NOT EXISTS poster_primary_color  TEXT,
  ADD COLUMN IF NOT EXISTS poster_width          INT,
  ADD COLUMN IF NOT EXISTS poster_height         INT,
  ADD COLUMN IF NOT EXISTS poster_status         TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (poster_status IN ('ok','missing','broken','low_quality','pending_review')),
  ADD COLUMN IF NOT EXISTS poster_source         TEXT
    CHECK (poster_source IN ('crawler','tmdb','douban','manual','upload'));

-- P1 横版治理（对应已有 backdrop_url）
ALTER TABLE media_catalog
  ADD COLUMN IF NOT EXISTS backdrop_blurhash      TEXT,
  ADD COLUMN IF NOT EXISTS backdrop_primary_color TEXT,
  ADD COLUMN IF NOT EXISTS backdrop_status        TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (backdrop_status IN ('ok','missing','broken','low_quality','pending_review'));

-- P2 可选：logo 透明艺术字
ALTER TABLE media_catalog
  ADD COLUMN IF NOT EXISTS logo_url    TEXT,
  ADD COLUMN IF NOT EXISTS logo_status TEXT NOT NULL DEFAULT 'missing'
    CHECK (logo_status IN ('ok','missing','broken','pending_review'));

-- P2 可选：Banner 专属横图
ALTER TABLE media_catalog
  ADD COLUMN IF NOT EXISTS banner_backdrop_url      TEXT,
  ADD COLUMN IF NOT EXISTS banner_backdrop_blurhash TEXT,
  ADD COLUMN IF NOT EXISTS banner_backdrop_status   TEXT NOT NULL DEFAULT 'missing'
    CHECK (banner_backdrop_status IN ('ok','missing','broken','pending_review'));

-- P3 可选：剧照集合（JSONB 空数组默认，防止 NULL 引发 jsonb 函数错误）
ALTER TABLE media_catalog
  ADD COLUMN IF NOT EXISTS stills_urls JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(stills_urls) = 'array'),
  ADD COLUMN IF NOT EXISTS stills_meta JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(stills_meta) = 'array');

-- ── 2. videos 新增图片治理汇总门控字段 ────────────────────────────
-- 仅保存汇总状态，不存图片 URL（URL 权威来源在 media_catalog）
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS image_governance_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (image_governance_status IN ('pending','ok','missing_poster','broken_poster'));

-- ── 3. broken_image_events 表 ─────────────────────────────────────
-- 记录所有图片健康异常事件，供监控和运营处理

CREATE TABLE IF NOT EXISTS broken_image_events (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id          UUID        NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  season_number     INT,
  episode_number    INT,
  image_kind        TEXT        NOT NULL
    CHECK (image_kind IN ('poster','backdrop','logo','banner_backdrop','stills','thumbnail')),
  url               TEXT        NOT NULL,
  url_hash_prefix   TEXT        NOT NULL,  -- sha256(url) 前 16 位十六进制，用于去重索引
  bucket_start      TIMESTAMPTZ NOT NULL,  -- floor(now, 10min)，时间窗口 key
  event_type        TEXT        NOT NULL
    CHECK (event_type IN ('client_load_error','empty_src','fetch_404','fetch_5xx','timeout','decode_fail','dimension_too_small','aspect_mismatch')),
  first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  occurrence_count  INT         NOT NULL DEFAULT 1,
  resolved_at       TIMESTAMPTZ,
  resolution_note   TEXT
);

-- 去重唯一约束：含 video_id 区分同 URL 被多视频引用时的独立事件
CREATE UNIQUE INDEX IF NOT EXISTS uq_broken_image_events_dedup
  ON broken_image_events (video_id, image_kind, url_hash_prefix, bucket_start);

-- 二级索引：跨视频聚合（CDN 故障定位，TOP 破损域名统计）
CREATE INDEX IF NOT EXISTS idx_broken_image_events_cdn
  ON broken_image_events (image_kind, url_hash_prefix, bucket_start);

-- 按视频查破图历史
CREATE INDEX IF NOT EXISTS idx_broken_image_events_video
  ON broken_image_events (video_id, image_kind, first_seen_at DESC);

-- 运营处理队列：未处理事件
CREATE INDEX IF NOT EXISTS idx_broken_image_events_unresolved
  ON broken_image_events (resolved_at) WHERE resolved_at IS NULL;

-- ── 4. video_episode_images 表 ───────────────────────────────────
-- 剧集缩略图（替代不存在的 episodes 表；逻辑集坐标由 video_sources 的 season/episode 确定）

CREATE TABLE IF NOT EXISTS video_episode_images (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id         UUID        NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  season_number    INT         NOT NULL DEFAULT 1,
  episode_number   INT         NOT NULL DEFAULT 1,
  thumbnail_url    TEXT,
  thumbnail_blurhash TEXT,
  thumbnail_status TEXT        NOT NULL DEFAULT 'pending_review'
    CHECK (thumbnail_status IN ('ok','missing','broken','pending_review')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (video_id, season_number, episode_number)
);

CREATE INDEX IF NOT EXISTS idx_video_episode_images_video
  ON video_episode_images (video_id, season_number, episode_number);
