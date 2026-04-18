-- 001_init_tables.sql
-- 描述：创建所有核心表
-- 日期：2026-03
-- 幂等：是（使用 IF NOT EXISTS，可重复执行）

-- ── 用户表 ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT        NOT NULL UNIQUE,
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'user'
                            CHECK (role IN ('user', 'moderator', 'admin')),
  locale        TEXT        NOT NULL DEFAULT 'en',
  avatar_url    TEXT,
  banned_at     TIMESTAMPTZ,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 视频表 ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS videos (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id      CHAR(8)     NOT NULL UNIQUE,
  slug          TEXT,
  title         TEXT        NOT NULL,
  title_en      TEXT,
  description   TEXT,
  cover_url     TEXT,
  type          TEXT        NOT NULL
                            CHECK (type IN ('movie', 'series', 'anime', 'variety')),
  category      TEXT,
  rating        FLOAT       CHECK (rating >= 0 AND rating <= 10),
  year          INT,
  country       TEXT,
  episode_count INT         NOT NULL DEFAULT 1,
  status        TEXT        NOT NULL DEFAULT 'ongoing'
                            CHECK (status IN ('ongoing', 'completed')),
  director      TEXT[]      NOT NULL DEFAULT '{}',
  "cast"        TEXT[]      NOT NULL DEFAULT '{}',
  writers       TEXT[]      NOT NULL DEFAULT '{}',
  is_published  BOOLEAN     NOT NULL DEFAULT false,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 播放源表 ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS video_sources (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id       UUID        NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  episode_number INT,
  source_url     TEXT        NOT NULL,
  source_name    TEXT        NOT NULL DEFAULT '线路1',
  quality        TEXT        CHECK (quality IN ('4K', '1080P', '720P', '480P', '360P')),
  type           TEXT        NOT NULL DEFAULT 'hls'
                             CHECK (type IN ('hls', 'mp4', 'dash')),
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  submitted_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
  last_checked   TIMESTAMPTZ,
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 字幕表 ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subtitles (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id       UUID        NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  episode_number INT,
  language       TEXT        NOT NULL,
  label          TEXT        NOT NULL,
  file_url       TEXT        NOT NULL,
  format         TEXT        NOT NULL
                             CHECK (format IN ('vtt', 'srt', 'ass')),
  uploaded_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
  is_verified    BOOLEAN     NOT NULL DEFAULT false,
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 标签表 ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tags (
  id       UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  name     TEXT  NOT NULL UNIQUE,
  name_en  TEXT,
  category TEXT
);

CREATE TABLE IF NOT EXISTS video_tags (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  tag_id   UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE (video_id, tag_id)
);

-- ── 片单表 ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lists (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id    CHAR(8)     NOT NULL UNIQUE,
  owner_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL
                          CHECK (type IN ('playlist', 'collection')),
  title       TEXT        NOT NULL,
  description TEXT,
  cover_url   TEXT,
  visibility  TEXT        NOT NULL DEFAULT 'public'
                          CHECK (visibility IN ('public', 'private', 'unlisted')),
  item_count  INT         NOT NULL DEFAULT 0,
  like_count  INT         NOT NULL DEFAULT 0,
  view_count  INT         NOT NULL DEFAULT 0,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS list_items (
  id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id  UUID        NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  video_id UUID        NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  position INT         NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (list_id, video_id)
);

CREATE TABLE IF NOT EXISTS list_likes (
  id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id  UUID        NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  liked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (list_id, user_id)
);

-- ── 弹幕表 ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS danmaku (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id       UUID        NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  episode_number INT,
  time_seconds   INT         NOT NULL,
  content        TEXT        NOT NULL,
  color          CHAR(7)     NOT NULL DEFAULT '#ffffff',
  type           TEXT        NOT NULL DEFAULT 'scroll'
                             CHECK (type IN ('scroll', 'top', 'bottom')),
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 评论表 ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS comments (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id       UUID        NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  episode_number INT,
  content        TEXT        NOT NULL,
  like_count     INT         NOT NULL DEFAULT 0,
  parent_id      UUID        REFERENCES comments(id) ON DELETE CASCADE,
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 观看历史 ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS watch_history (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id         UUID        NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  episode_number   INT,
  progress_seconds INT         NOT NULL DEFAULT 0,
  watched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, video_id, episode_number)
);

-- ── 收藏表 ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_favorites (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id     UUID        NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  favorited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, video_id)
);

-- ── 爬虫任务表 ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crawler_tasks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site  TEXT        NOT NULL,
  target_url   TEXT,
  type         TEXT        NOT NULL DEFAULT 'full-crawl'
                           CHECK (type IN ('full-crawl', 'incremental-crawl', 'verify-source', 'verify-single')),
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'running', 'done', 'failed')),
  retry_count  INT         NOT NULL DEFAULT 0,
  result       JSONB,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at  TIMESTAMPTZ
);
