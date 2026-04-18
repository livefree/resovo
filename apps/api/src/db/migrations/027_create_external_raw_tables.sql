-- 027_create_external_raw_tables.sql
-- CHG-359: 创建外部数据暂存表（Douban / TMDB / Bangumi / MovieLens ID 桥接）
-- 用途：将外部 CSV/JSONLINES 文件原始数据导入暂存，再由 ExternalDataImportService 批量构建 media_catalog
-- 幂等：可重复执行，已存在时跳过

BEGIN;

-- ── 批次登记表 ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS external_import_batches (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source         TEXT        NOT NULL
                 CHECK (source IN ('douban', 'tmdb', 'bangumi', 'movielens')),
  file_name      TEXT        NOT NULL,
  file_size_bytes BIGINT,
  total_rows     INT,
  imported_rows  INT         NOT NULL DEFAULT 0,
  status         TEXT        NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'running', 'done', 'failed')),
  started_at     TIMESTAMPTZ,
  finished_at    TIMESTAMPTZ,
  error_msg      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Douban 电影原始数据（14 万行）────────────────────────────────

-- 字段按 external-db/douban/moviedata-10m/movies.csv 实际列名保留
-- MOVIE_ID = 豆瓣内部 ID（即豆瓣电影 ID，对应 media_catalog.douban_id）

CREATE TABLE IF NOT EXISTS external_douban_movies_raw (
  id            BIGSERIAL   PRIMARY KEY,
  batch_id      UUID        NOT NULL REFERENCES external_import_batches(id),
  movie_id      TEXT,         -- 豆瓣电影 ID
  name          TEXT,         -- 简体中文标准名
  alias         TEXT,         -- 别名，/ 分割
  actors        TEXT,         -- 主演，/ 分割
  cover         TEXT,         -- 封面图 URL
  directors     TEXT,         -- 导演，/ 分割
  douban_score  NUMERIC(4,1),
  douban_votes  NUMERIC,
  genres        TEXT,         -- 类型，/ 分割（如"剧情/爱情"）
  imdb_id       TEXT,
  languages     TEXT,
  mins          NUMERIC,      -- 片长（分钟，部分为 0.0 表示未知）
  regions       TEXT,         -- 制片国家/地区
  release_date  TEXT,         -- 上映日期（格式不统一，TEXT 存储）
  slug          TEXT,         -- 豆瓣加密 slug，可忽略
  storyline     TEXT,         -- 剧情描述
  tags          TEXT,         -- 标签
  year          INT,
  -- 匹配结果（导入后由 buildCatalogFromDouban 回填）
  catalog_id    UUID          REFERENCES media_catalog(id),
  imported_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_douban_raw_imdb_id
  ON external_douban_movies_raw (imdb_id)
  WHERE imdb_id IS NOT NULL AND imdb_id != '';

CREATE INDEX IF NOT EXISTS idx_douban_raw_movie_id
  ON external_douban_movies_raw (movie_id)
  WHERE movie_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_douban_raw_catalog_id
  ON external_douban_movies_raw (catalog_id)
  WHERE catalog_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_douban_raw_batch_id
  ON external_douban_movies_raw (batch_id);

-- ── TMDB 电影原始数据（124 万行）────────────────────────────────

-- 字段按 external-db/tmdb/[124万]TMDB电影元数据.csv 实际列名保留
-- 注意：title 字段是英文名，不是简体中文

CREATE TABLE IF NOT EXISTS external_tmdb_movies_raw (
  id                   BIGSERIAL   PRIMARY KEY,
  batch_id             UUID        NOT NULL REFERENCES external_import_batches(id),
  tmdb_id              INT,
  title                TEXT,         -- 英文名（TMDB 默认语言）
  original_title       TEXT,         -- 原始语言标题
  imdb_id              TEXT,
  release_date         TEXT,
  runtime              INT,          -- 片长（分钟）
  adult                BOOLEAN     NOT NULL DEFAULT false,
  poster_path          TEXT,         -- 相对路径，拼接时用 https://image.tmdb.org/t/p/w500{path}
  overview             TEXT,         -- 英文简介
  genres               TEXT,         -- 题材（如 "Action, Science Fiction"）
  production_countries TEXT,         -- 制片国家（如 "United States of America"）
  spoken_languages     TEXT,
  vote_average         NUMERIC(4,2),
  vote_count           INT,
  -- 匹配结果
  catalog_id           UUID          REFERENCES media_catalog(id),
  imported_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tmdb_raw_tmdb_id
  ON external_tmdb_movies_raw (tmdb_id)
  WHERE tmdb_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tmdb_raw_imdb_id
  ON external_tmdb_movies_raw (imdb_id)
  WHERE imdb_id IS NOT NULL AND imdb_id != '';

CREATE INDEX IF NOT EXISTS idx_tmdb_raw_catalog_id
  ON external_tmdb_movies_raw (catalog_id)
  WHERE catalog_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tmdb_raw_batch_id
  ON external_tmdb_movies_raw (batch_id);

-- ── Bangumi 条目原始数据（约 5 万行，只存 type=2 动画和 type=6 真人影视）──

-- 字段按 external-db/bangumi/subject.jsonlines 实际结构
-- type=2：动画/OVA → media_catalog.type='anime'
-- type=6：三次元真人影视 → 'movie' 或 'series'

CREATE TABLE IF NOT EXISTS external_bangumi_subjects_raw (
  id              BIGSERIAL   PRIMARY KEY,
  batch_id        UUID        NOT NULL REFERENCES external_import_batches(id),
  bangumi_id      INT         NOT NULL,
  bgm_type        INT         NOT NULL,   -- 2=anime, 6=live_action
  name            TEXT,                    -- 原始语言名（通常为日文）
  name_cn         TEXT,                    -- 简体中文名（75% 有值）
  date            TEXT,                    -- 首播日期（格式 YYYY-MM-DD）
  platform        INT,
  summary         TEXT,                    -- 简介
  tags            JSONB,                   -- 标签数组
  -- 匹配结果
  catalog_id      UUID          REFERENCES media_catalog(id),
  imported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bangumi_raw_bangumi_id
  ON external_bangumi_subjects_raw (bangumi_id);

CREATE INDEX IF NOT EXISTS idx_bangumi_raw_catalog_id
  ON external_bangumi_subjects_raw (catalog_id)
  WHERE catalog_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bangumi_raw_batch_id
  ON external_bangumi_subjects_raw (batch_id);

-- ── MovieLens ID 桥接表（8.7 万行）──────────────────────────────

-- 来源：external-db/movielens/ml-32m/links.csv
-- 用途：Douban IMDB_ID → movielens imdb_id → tmdb_id（纯工具表，不是内容来源）
-- imdb_id 格式：MovieLens 存储时不带 tt 前缀，导入时统一补全

CREATE TABLE IF NOT EXISTS external_imdb_tmdb_links (
  movielens_id  INT         PRIMARY KEY,
  imdb_id       TEXT        NOT NULL UNIQUE,   -- 格式：tt0000000（带 tt 前缀）
  tmdb_id       INT         NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_imdb_tmdb_links_imdb
  ON external_imdb_tmdb_links (imdb_id);

CREATE INDEX IF NOT EXISTS idx_imdb_tmdb_links_tmdb
  ON external_imdb_tmdb_links (tmdb_id);

COMMIT;
