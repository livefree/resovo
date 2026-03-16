-- 002_indexes.sql
-- 描述：创建所有核心索引，优化常用查询路径
-- 日期：2026-03
-- 幂等：是（使用 IF NOT EXISTS，可重复执行）

-- ── users 索引 ───────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS users_email_key
  ON users(email);

CREATE UNIQUE INDEX IF NOT EXISTS users_username_key
  ON users(username);

CREATE INDEX IF NOT EXISTS idx_users_role
  ON users(role);

-- ── videos 索引 ──────────────────────────────────────────────────────

-- short_id 唯一索引（URL 查询主力）
CREATE UNIQUE INDEX IF NOT EXISTS videos_short_id_key
  ON videos(short_id);

-- 上架状态部分索引（前台只查已上架）
CREATE INDEX IF NOT EXISTS idx_videos_published
  ON videos(is_published) WHERE is_published = true;

-- 类型 + 年份 + 评分过滤
CREATE INDEX IF NOT EXISTS idx_videos_type
  ON videos(type);

CREATE INDEX IF NOT EXISTS idx_videos_year
  ON videos(year);

CREATE INDEX IF NOT EXISTS idx_videos_rating
  ON videos(rating);

CREATE INDEX IF NOT EXISTS idx_videos_country
  ON videos(country);

CREATE INDEX IF NOT EXISTS idx_videos_created_at
  ON videos(created_at DESC);

-- 软删除过滤（所有查询都带 deleted_at IS NULL）
CREATE INDEX IF NOT EXISTS idx_videos_deleted_at
  ON videos(deleted_at) WHERE deleted_at IS NULL;

-- TEXT[] 字段 GIN 索引（数组包含查询）
CREATE INDEX IF NOT EXISTS idx_videos_director
  ON videos USING gin(director);

CREATE INDEX IF NOT EXISTS idx_videos_cast
  ON videos USING gin("cast");

CREATE INDEX IF NOT EXISTS idx_videos_writers
  ON videos USING gin(writers);

-- ── video_sources 索引 ───────────────────────────────────────────────

-- 按视频查询播放源（最常用）
CREATE INDEX IF NOT EXISTS idx_sources_video_id
  ON video_sources(video_id);

-- 按视频 + 集数查询（播放页加载）
CREATE INDEX IF NOT EXISTS idx_sources_video_episode
  ON video_sources(video_id, episode_number);

-- 只查有效播放源
CREATE INDEX IF NOT EXISTS idx_sources_active
  ON video_sources(is_active) WHERE is_active = true;

-- 待验证的播放源（定时任务用）
CREATE INDEX IF NOT EXISTS idx_sources_last_checked
  ON video_sources(last_checked);

-- 去重约束：同一视频不重复插入相同 source_url（upsert 用）
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_sources_video_url' AND conrelid = 'video_sources'::regclass
  ) THEN
    ALTER TABLE video_sources ADD CONSTRAINT uq_sources_video_url
      UNIQUE (video_id, source_url);
  END IF;
END $$;

-- ── subtitles 索引 ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_subtitles_video_id
  ON subtitles(video_id);

CREATE INDEX IF NOT EXISTS idx_subtitles_video_language
  ON subtitles(video_id, language);

-- ── lists 索引 ───────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS lists_short_id_key
  ON lists(short_id);

CREATE INDEX IF NOT EXISTS idx_lists_owner_id
  ON lists(owner_id);

CREATE INDEX IF NOT EXISTS idx_lists_visibility
  ON lists(visibility);

CREATE INDEX IF NOT EXISTS idx_lists_created_at
  ON lists(created_at DESC);

-- ── list_items 索引 ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_list_items_list_id
  ON list_items(list_id, position);

-- ── danmaku 索引 ─────────────────────────────────────────────────────

-- 时间轴查询（播放时实时加载）
CREATE INDEX IF NOT EXISTS idx_danmaku_video_episode_time
  ON danmaku(video_id, episode_number, time_seconds ASC);

-- ── watch_history 索引 ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_watch_history_user_id
  ON watch_history(user_id, watched_at DESC);

CREATE INDEX IF NOT EXISTS idx_watch_history_video_id
  ON watch_history(video_id);

-- ── crawler_tasks 索引 ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_crawler_tasks_status
  ON crawler_tasks(status);

CREATE INDEX IF NOT EXISTS idx_crawler_tasks_source_site
  ON crawler_tasks(source_site);

CREATE INDEX IF NOT EXISTS idx_crawler_tasks_scheduled_at
  ON crawler_tasks(scheduled_at DESC);
