-- 065_user_submissions.sql
-- 描述：新建 user_submissions — 4 类用户投稿统一表（spec §5.13）
-- 日期：2026-05-19
-- ADR：ADR-124（user_submissions schema + API 协议）
-- 任务卡：CHG-SN-7-REDO-02-A / SEQ-20260519-03
-- 幂等：是（IF NOT EXISTS + CREATE OR REPLACE + ON CONFLICT DO NOTHING）
--
-- 关键设计要点（详 ADR-124）：
--   - type 3 值 CHECK：'bad_source' / 'wish_list' / 'metadata_correction'
--   - status 3 态机：'pending' → 'processed' / 'rejected'（CHECK 守卫）
--   - video_id NULL（求片场景）/ source_id NULL（求片+纠错场景）
--   - quote TEXT 1-2000 字符（自然语言主体）
--   - metadata_jsonb JSONB（按 type shape 不同；zod 在 service 层 runtime 校验）
--   - chk_bad_source_has_source / chk_metadata_correction_has_video 类型一致性
--   - chk_processed_consistency 状态机一致性
--   - AD1：metadata_jsonb jsonb_typeof='object' 弱校验
--   - AD2：badges 聚合走 partial index WHERE status='pending'
--   - D-124-8 backfill：历史 video_sources.is_active=false AND submitted_by IS NOT NULL
--                        → bad_source（保留 video_sources 行 / 双轨 / ON CONFLICT DO NOTHING）

BEGIN;

CREATE TABLE IF NOT EXISTS user_submissions (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  type              TEXT         NOT NULL
                                 CHECK (type IN ('bad_source', 'wish_list', 'metadata_correction')),
  status            TEXT         NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'processed', 'rejected')),
  video_id          UUID         NULL REFERENCES videos(id) ON DELETE SET NULL,
  source_id         UUID         NULL REFERENCES video_sources(id) ON DELETE SET NULL,
  submitted_by      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quote             TEXT         NOT NULL CHECK (char_length(quote) BETWEEN 1 AND 2000),
  metadata_jsonb    JSONB        NULL,
  processed_by      UUID         NULL REFERENCES users(id) ON DELETE SET NULL,
  processed_at      TIMESTAMPTZ  NULL,
  processed_reason  TEXT         NULL CHECK (processed_reason IS NULL OR char_length(processed_reason) <= 500),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- 类型一致性 CHECK（D-124-1 polymorphic schema 完整性）
  CONSTRAINT chk_bad_source_has_source
    CHECK (type <> 'bad_source' OR source_id IS NOT NULL),
  CONSTRAINT chk_metadata_correction_has_video
    CHECK (type <> 'metadata_correction' OR video_id IS NOT NULL),

  -- 状态机一致性 CHECK（D-124-1 + processed_at 必须与 status 同步）
  CONSTRAINT chk_processed_consistency
    CHECK ((status = 'pending') = (processed_at IS NULL)),

  -- AD1：metadata_jsonb 弱校验（jsonb_typeof='object' / NULL 允许）
  CONSTRAINT chk_metadata_is_object
    CHECK (metadata_jsonb IS NULL OR jsonb_typeof(metadata_jsonb) = 'object')
);

-- AD2：badges 聚合走 partial index（高频列表 + 4 计数查询避免全表扫）
CREATE INDEX IF NOT EXISTS idx_user_submissions_pending_type_created
  ON user_submissions (type, created_at DESC) WHERE status = 'pending';

-- 主列表查询索引（status/type 复合 + created_at DESC）
CREATE INDEX IF NOT EXISTS idx_user_submissions_status_type_created
  ON user_submissions (status, type, created_at DESC);

-- JOIN videos / submitter 索引
CREATE INDEX IF NOT EXISTS idx_user_submissions_video_id
  ON user_submissions (video_id) WHERE video_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_submissions_submitted_by
  ON user_submissions (submitted_by);

-- updated_at trigger（与 home_modules / source_line_aliases / crawler_site_category_maps 同模式）
CREATE OR REPLACE FUNCTION trg_user_submissions_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_submissions_updated_at ON user_submissions;
CREATE TRIGGER user_submissions_updated_at
  BEFORE UPDATE ON user_submissions
  FOR EACH ROW EXECUTE FUNCTION trg_user_submissions_set_updated_at();

-- D-124-8 backfill：历史 video_sources.is_active=false AND submitted_by IS NOT NULL → bad_source
-- 保留 video_sources 行不删（避免破坏 P1 video.refetch_sources 链路 / 双轨过渡至 M-SN-9 退役）
INSERT INTO user_submissions (type, status, video_id, source_id, submitted_by, quote, created_at)
SELECT 'bad_source', 'pending', vs.video_id, vs.id, vs.submitted_by,
       '【迁移】历史失效源举报', vs.created_at
FROM video_sources vs
WHERE vs.is_active = false
  AND vs.submitted_by IS NOT NULL
  AND vs.deleted_at IS NULL
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  table_count INT;
BEGIN
  SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name = 'user_submissions';

  IF table_count < 1 THEN
    RAISE EXCEPTION 'Migration 065: user_submissions 表不存在';
  END IF;

  RAISE NOTICE 'Migration 065 OK: user_submissions 已建表 + 4 indexes + trigger + backfill';
END $$;

COMMIT;

-- ── ROLLBACK ──────────────────────────────────────────────────────
-- 注意：rollback 会丢失新表内所有 user_submissions 行（含 backfill 的历史失效源举报副本）；
--        video_sources 原始行不受影响（backfill 仅 INSERT 未 UPDATE / DELETE）。
-- BEGIN;
-- DROP TRIGGER IF EXISTS user_submissions_updated_at ON user_submissions;
-- DROP FUNCTION IF EXISTS trg_user_submissions_set_updated_at();
-- DROP INDEX IF EXISTS idx_user_submissions_submitted_by;
-- DROP INDEX IF EXISTS idx_user_submissions_video_id;
-- DROP INDEX IF EXISTS idx_user_submissions_status_type_created;
-- DROP INDEX IF EXISTS idx_user_submissions_pending_type_created;
-- DROP TABLE IF EXISTS user_submissions;
-- COMMIT;
