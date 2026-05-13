-- 062_create_video_merge_audit.sql
-- 描述：video 层合并/拆分历史审计 + restore snapshot
-- 日期：2026-05-12
-- ADR：ADR-105
-- 幂等：是（CREATE TABLE IF NOT EXISTS）

BEGIN;

CREATE TABLE IF NOT EXISTS video_merge_audit (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  action            TEXT         NOT NULL CHECK (action IN ('merge', 'split')),
  source_video_ids  UUID[]       NOT NULL,
  target_video_ids  UUID[]       NOT NULL,
  -- merge: source_video_ids = 被合并的 [v1,v2,...] / target_video_ids = [target]
  -- split: source_video_ids = [拆分前 video] / target_video_ids = 拆分后 [v1,v2,...]
  snapshot_jsonb    JSONB        NOT NULL,
  -- 完整备份：{ videos: [{...}], sources: [{...}], aliases: [{...}] }
  -- unmerge / split 撤销时基于 snapshot 还原；JSONB 而非外键避免 cascade 删除丢历史
  performed_by      UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  -- admin user id（R-105-2 修订：UUID + 外键约束，与 admin_audit_log.actor_id 同类型同语义；migration 052:26 对照）
  reason            TEXT         NULL,
  -- 运营备注（可选；从 endpoint body.reason 透传）
  performed_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  reverted_at       TIMESTAMPTZ  NULL,
  -- unmerge / split 撤销时设此字段；非 NULL = 该次操作已被撤销
  reverted_by       UUID         NULL REFERENCES users(id) ON DELETE RESTRICT,
  reverted_reason   TEXT         NULL,
  CONSTRAINT video_merge_audit_revert_consistency
    CHECK ((reverted_at IS NULL AND reverted_by IS NULL AND reverted_reason IS NULL)
        OR (reverted_at IS NOT NULL AND reverted_by IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS video_merge_audit_action_idx
  ON video_merge_audit (action, performed_at DESC)
  WHERE reverted_at IS NULL;

CREATE INDEX IF NOT EXISTS video_merge_audit_source_videos_gin
  ON video_merge_audit USING GIN (source_video_ids);

CREATE INDEX IF NOT EXISTS video_merge_audit_target_videos_gin
  ON video_merge_audit USING GIN (target_video_ids);

COMMIT;

-- ── down 路径（注释保留，运维手动） ─────────────────────────────────
-- BEGIN;
-- DROP INDEX IF EXISTS video_merge_audit_target_videos_gin;
-- DROP INDEX IF EXISTS video_merge_audit_source_videos_gin;
-- DROP INDEX IF EXISTS video_merge_audit_action_idx;
-- DROP TABLE IF EXISTS video_merge_audit;
-- COMMIT;
