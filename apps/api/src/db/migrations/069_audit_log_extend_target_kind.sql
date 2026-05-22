-- 069_audit_log_extend_target_kind.sql
-- ADR-140 §5 Migration B / ADR-139 D-139-6 / CHG-SN-8-FUP-USERS-EDIT-EP
--
-- admin_audit_log.target_kind CHECK 约束扩展 6 → 13 种：
--   原 6 种（migration 052）：video / video_source / staging / review_label / crawler_site / system
--   一次性补齐 7 种历史漂移 + 新增：
--     • home_module               — ADR-104 (CHG-SN-5-05/-06)
--     • source_line_alias         — ADR-117 (CHG-SN-5-11-PATCH)
--     • source_route              — ADR-117 AMENDMENT 2 (CHG-SN-7-REDO-01-E2)
--     • user_submission           — ADR-124 (CHG-SN-7-REDO-02-A)
--     • image_health              — ADR-135 (CHG-SN-7-MISC-IMAGE-1)
--     • user                      — ADR-139 (CHG-SN-8-FUP-USERS-ROLE-INV-EP) + ADR-140 (本卡 user.email_change + user.profile_update)
--
-- ADR-140 D-140-5 指定一次性消除 TS union 与 DB CHECK 长期漂移，避免运行时 INSERT reject。
-- 紧迫：USERS-ROLE-INV-EP commit c2594fa7 已用 'user' target_kind 写入 audit，但旧 CHECK 会 reject — 本 migration 不落地则生产 PG 失败。
--
-- 详见 ADR-140 §10 R-140-4（回退路径：ALTER 仅扩展不删除已有值，向后兼容）

BEGIN;

ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_target_kind_check;
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_target_kind_check
  CHECK (target_kind IN (
    'video', 'video_source', 'staging', 'review_label', 'crawler_site', 'system',
    'home_module', 'source_line_alias', 'source_route', 'user_submission', 'image_health',
    'user'
  ));

COMMENT ON COLUMN admin_audit_log.target_kind
  IS 'CHECK 约束限定 12 种（ADR-140 §5 Migration B 扩展 user + 历史漂移补齐 6→12）；扩展须先改约束';

COMMIT;
