-- 045_fix_video_external_refs_unique.sql
-- META bugfix: upsertVideoExternalRef 使用 ON CONFLICT (video_id, provider, external_id)
-- 但 041 迁移只建了 partial unique index 和普通索引，没有匹配该冲突目标的 UNIQUE 约束。
-- 真实 Postgres 会报 "there is no unique or exclusion constraint matching the ON CONFLICT"。
-- 本迁移补建该 UNIQUE INDEX，幂等执行。

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_video_external_refs_vid_prov_ext
  ON video_external_refs (video_id, provider, external_id);

DO $$
BEGIN
  RAISE NOTICE 'Migration 045 OK: uq_video_external_refs_vid_prov_ext 已创建';
END $$;

COMMIT;
