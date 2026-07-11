-- 128_video_play_stats.sql
-- 描述：视频级播放量统计体系数据底座——append-only 事件真源 + 派生聚合表（hourly/daily/
--       daily_visitors/totals/hot_scores）。仅建 schema，写入/聚合/读取业务逻辑归 STATS-03/04/05。
-- 决策真源：docs/decisions.md ADR-216（D-216-1~10）+ 设计文档 video-play-stats-structure_20260624.md §schema
-- 任务卡：STATS-02-SCHEMA / SEQ-20260624-02
-- 子代理：codex:codex-rescue（任务卡 + DDL 对抗审，范围 ≥3 项强制；ADR-216 已 Opus arch-reviewer + Codex 双审冻结设计）
-- 日期：2026-06-25
-- 起号说明：dev 当前最新 127_video_sources_audio_language_index 已占本分支 → STATS schema 顺延 128（ADR-216 §schema 起号）。
--
-- ⚠️ Down 路径说明（项目约定，同 124/095/097）：
--   scripts/migrate.ts 将整个文件内容作为单条 SQL 执行，不区分 up/down 节。
--   down 路径必须保持注释形式；需要回滚时手动解注释独立执行。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

-- video_play_events — append-only 可重放真源（D-216 不变量①）；只存 qualified play，不存每次 timeupdate。
CREATE TABLE IF NOT EXISTS video_play_events (
  id                   BIGSERIAL PRIMARY KEY,
  -- D-216-8 第一防线：前端确定性 key，API 原样存。**显式命名约束**（非依赖 PG 自动名）→ STATS-03 精确捕获 23505 err.constraint 不漂移（Codex MEDIUM）。
  idempotency_key      TEXT NOT NULL
                       CONSTRAINT uq_video_play_events_idempotency_key UNIQUE,

  video_id             UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,  -- 内部 video_id（短码 short_id 在 service 层解析）
  source_id            UUID NULL REFERENCES video_sources(id) ON DELETE SET NULL,
  episode_number       INT NULL,

  event_type           TEXT NOT NULL DEFAULT 'qualified_play'
                       CHECK (event_type IN ('qualified_play')),               -- L3：单值为 v1 边界，扩展走 migration 加 CHECK 值 + amendment
  play_session_id      TEXT NOT NULL,

  visitor_hash         TEXT NOT NULL,                                          -- D-216-7：HMAC(rv_vid, secret) 截断 hex，不可逆，无 PII
  visitor_is_ephemeral BOOLEAN NOT NULL DEFAULT false,                        -- D-216-7 H1 冻结：cookie 缺失 fallback 行置 true；聚合仅对 NOT ephemeral 计 UV
  ip_hash              TEXT NULL,                                             -- 仅限流维度，不存原始 IP（核心不变量⑤）
  user_id              UUID NULL REFERENCES users(id) ON DELETE SET NULL,     -- D-216-5：来自 optionalAuthenticate request.user，匿名为 NULL；写路径不查 users

  watch_seconds        INT NOT NULL CHECK (watch_seconds >= 0),
  duration_seconds     INT NULL CHECK (duration_seconds IS NULL OR duration_seconds > 0),

  locale               TEXT NULL,
  referrer_path        TEXT NULL,
  user_agent_hash      TEXT NULL,                                             -- UA hash，不存原始 UA

  occurred_at          TIMESTAMPTZ NOT NULL,                                  -- D-216-9 trusted（service 端非对称 clamp 后写入）；所有 bucket 用此值
  ingested_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  aggregated_at        TIMESTAMPTZ NULL                                       -- 不变量②：聚合幂等标记；NULL=未聚合（retention 永不删）
);

-- pending 取数索引（D-216-10：FOR UPDATE SKIP LOCKED 取 aggregated_at IS NULL ORDER BY ingested_at ASC）
CREATE INDEX IF NOT EXISTS idx_video_play_events_pending
  ON video_play_events (ingested_at)
  WHERE aggregated_at IS NULL;

-- 单视频时间序读（debug / 内部巡检）
CREATE INDEX IF NOT EXISTS idx_video_play_events_video_time
  ON video_play_events (video_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_video_play_events_occurred_at
  ON video_play_events (occurred_at DESC);

-- D-216-8 第二防线：null-safe 业务唯一约束（用内部 video_id；命中 23505 与 idempotency_key 一并当幂等 202）
CREATE UNIQUE INDEX IF NOT EXISTS uq_video_play_events_session_video_episode
  ON video_play_events (play_session_id, video_id, COALESCE(episode_number, 0));

COMMENT ON TABLE video_play_events
  IS 'ADR-216 视频级播放量 append-only 事件真源（只存 qualified play）；双重幂等写第一/第二防线（idempotency_key UNIQUE + uq_session_video_episode）；聚合靠 aggregated_at 标记，未聚合永不删；occurred_at 为 service 端 trusted/clamp 值。';

-- video_play_hourly — 近期趋势 + hot-score 重算数据源（D-216-3：hot_score 从本表按窗口全量重算）。
CREATE TABLE IF NOT EXISTS video_play_hourly (
  video_id              UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  bucket_hour           TIMESTAMPTZ NOT NULL,
  play_count            BIGINT NOT NULL DEFAULT 0,
  anon_play_count       BIGINT NOT NULL DEFAULT 0,
  logged_in_play_count  BIGINT NOT NULL DEFAULT 0,
  total_watch_seconds   BIGINT NOT NULL DEFAULT 0,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (video_id, bucket_hour)
);

-- today 滚动 24h 读（D-216-2）+ hot_score 24h/7d/30d 窗口重算扫描
CREATE INDEX IF NOT EXISTS idx_video_play_hourly_hour
  ON video_play_hourly (bucket_hour DESC, play_count DESC);

-- video_play_daily — 后台分析 + week/month 近 7/30 自然日趋势真源（D-216-2）。
CREATE TABLE IF NOT EXISTS video_play_daily (
  video_id              UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  bucket_date           DATE NOT NULL,
  play_count            BIGINT NOT NULL DEFAULT 0,
  unique_visitor_count  BIGINT NOT NULL DEFAULT 0,                            -- D-216-7：仅 NOT visitor_is_ephemeral 行计入（聚合 STATS-04）
  anon_play_count       BIGINT NOT NULL DEFAULT 0,
  logged_in_play_count  BIGINT NOT NULL DEFAULT 0,
  total_watch_seconds   BIGINT NOT NULL DEFAULT 0,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (video_id, bucket_date)
);

CREATE INDEX IF NOT EXISTS idx_video_play_daily_date
  ON video_play_daily (bucket_date DESC, play_count DESC);

-- video_play_daily_visitors — daily UV 去重 helper（运营表，非前台读模型）。D-216-7：仅 cookie-backed visitor 入表。
CREATE TABLE IF NOT EXISTS video_play_daily_visitors (
  video_id       UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  bucket_date    DATE NOT NULL,
  visitor_hash   TEXT NOT NULL,
  first_seen_at  TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (video_id, bucket_date, visitor_hash)
);

-- D-216-6 retention：本表 400 天清理（按 bucket_date 索引）
CREATE INDEX IF NOT EXISTS idx_video_play_daily_visitors_date
  ON video_play_daily_visitors (bucket_date);

-- video_play_totals — O(1) 累计展示读模型（STATS-05-A 左连 + COALESCE(0)）。
CREATE TABLE IF NOT EXISTS video_play_totals (
  video_id          UUID PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
  total_play_count  BIGINT NOT NULL DEFAULT 0,
  last_played_at    TIMESTAMPTZ NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_play_totals_count
  ON video_play_totals (total_play_count DESC);

-- video_hot_scores — 跨前台/搜索一致热度物化源（D-216-3：必需物化，ES 无法引用瞬时 PG 计算）。
CREATE TABLE IF NOT EXISTS video_hot_scores (
  video_id          UUID PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
  hot_score         NUMERIC NOT NULL DEFAULT 0,                              -- = 24h×1.0 + 7d×0.3 + 30d×0.1（按窗口全量重算，非增量累加）
  play_count_24h    BIGINT NOT NULL DEFAULT 0,                               -- 嵌套窗口：7d 含 24h、30d 含 7d（L1）
  play_count_7d     BIGINT NOT NULL DEFAULT 0,
  play_count_30d    BIGINT NOT NULL DEFAULT 0,
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()                       -- 快照时刻
);

-- 统一排序口径：hot_score DESC NULLS LAST, play_count_7d DESC, ...（D-216-3）
CREATE INDEX IF NOT EXISTS idx_video_hot_scores_hot
  ON video_hot_scores (hot_score DESC, play_count_7d DESC);

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- DROP TABLE IF EXISTS video_hot_scores;
-- DROP TABLE IF EXISTS video_play_totals;
-- DROP TABLE IF EXISTS video_play_daily_visitors;
-- DROP TABLE IF EXISTS video_play_daily;
-- DROP TABLE IF EXISTS video_play_hourly;
-- DROP TABLE IF EXISTS video_play_events;
-- COMMIT;
