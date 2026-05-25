-- 073_audit_log_extend_target_kind_crawler_task.sql
-- ADR-151 D-151-4 / R-MID-1 第 26 次系统化
--
-- admin_audit_log.target_kind CHECK 约束扩展 13 → 14 种：
--   新增：crawler_task（task 级 cancel 单点 audit；batch 复用 'system'）
--
-- 与 migration 072 同范式（ADR-144 先例）

BEGIN;

ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_target_kind_check;
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_target_kind_check
  CHECK (target_kind IN (
    'video', 'video_source', 'staging', 'review_label', 'crawler_site', 'system',
    'home_module', 'source_line_alias', 'source_route', 'user_submission', 'image_health',
    'user', 'filter_preset', 'crawler_task'
  ));

COMMENT ON COLUMN admin_audit_log.target_kind
  IS 'CHECK 限定 14 种（ADR-151 扩展 crawler_task；13→14）';

COMMIT;
