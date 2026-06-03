-- 085_title_observations.sql
-- 描述：标题观测 shadow 表（SEQ-20260602-03 / CHG-VIR-6 / Phase 1b）
--   schema 真源 = docs/designs/video-identity-resolution-redesign_20260602.md §1b（**无独立 ADR**）
--   单一用途：采集链路 shadow 观测各源原始标题 + TitleIdentityParser 解析 facets。
--   **不进任何唯一约束 / 不参与归并决策**（设计 §1b 复核 F1 定档）；纯观测，去重聚合避免无限快照。
-- 日期：2026-06-02
-- 幂等：是（IF NOT EXISTS）
-- ADR: 无（shadow 观测表，schema 真源=设计 §1b）。core_title_key/facets 解析器=ADR-105a D-105a-1。
--
-- 索引设计 4 步核验（db-rules.md §"索引设计 4 步核验"）：
--   1. 索引键：(video_id, COALESCE(source_site_key,''), COALESCE(source_name,''), raw_title_hash,
--      parser_version) —— 去重唯一键（设计 §1b 建议唯一键）；+ (video_id) 反查聚合。
--   2. 部分索引 WHERE：N/A（去重键覆盖全表，无软删除/状态过滤）
--   3. 候选 driving 谓词：① upsert ON CONFLICT 命中去重键；② 离线分析 WHERE video_id = $1 聚合
--   4. 匹配判定：去重唯一索引 + video_id 反查索引完整覆盖两类访问，不需额外索引

BEGIN;

CREATE TABLE IF NOT EXISTS title_observations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id            UUID        NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  source_site_key     TEXT,                                   -- 采集站点 key（COALESCE('') 进去重键）
  source_name         TEXT,                                   -- 播放源名（site 级观测通常 NULL）
  raw_title           TEXT        NOT NULL,                   -- 源站原始标题（未归一）
  raw_title_hash      TEXT        NOT NULL,                   -- raw_title 的 sha256 hex（窄化去重键）
  parser_version      TEXT        NOT NULL,                   -- TITLE_PARSER_VERSION（版本升级 → 新观测行）
  parsed_facets_jsonb JSONB       NOT NULL DEFAULT '{}'::jsonb, -- {coreTitleKey,titleKind,confidence,facets}
  observed_count      INTEGER     NOT NULL DEFAULT 1,         -- 同键重复观测累加（去重聚合，非快照）
  first_seen_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 去重唯一键（设计 §1b）：同 video + 站点 + 源名 + 标题hash + parser 版本 → 唯一一行，重复仅 +observed_count
CREATE UNIQUE INDEX IF NOT EXISTS uq_title_observations_dedupe
  ON title_observations (
    video_id,
    COALESCE(source_site_key, ''),
    COALESCE(source_name, ''),
    raw_title_hash,
    parser_version
  );

-- 反查：按 video 聚合观测（离线身份解析分析 / 后台展示）
CREATE INDEX IF NOT EXISTS idx_title_observations_video
  ON title_observations (video_id);

COMMIT;

-- 验证：表与去重索引存在
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'title_observations'
  ) THEN
    RAISE EXCEPTION 'Migration 085 failed: title_observations table not created';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_title_observations_dedupe'
  ) THEN
    RAISE EXCEPTION 'Migration 085 failed: uq_title_observations_dedupe index not created';
  END IF;
END $$;
