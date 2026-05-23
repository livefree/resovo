-- 072_audit_log_extend_target_kind_filter_preset.sql
-- ADR-144 D-144-5 / R-MID-1 第 21-23 次系统化
--
-- admin_audit_log.target_kind CHECK 约束扩展 12 → 13 种：
--   新增：filter_preset（FilterPreset CRUD 审计）
--
-- 与 migration 069 同范式（ADR-140 先例）

BEGIN;

ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_target_kind_check;
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_target_kind_check
  CHECK (target_kind IN (
    'video', 'video_source', 'staging', 'review_label', 'crawler_site', 'system',
    'home_module', 'source_line_alias', 'source_route', 'user_submission', 'image_health',
    'user', 'filter_preset'
  ));

COMMENT ON COLUMN admin_audit_log.target_kind
  IS 'CHECK 限定 13 种（ADR-144 扩展 filter_preset；12→13）';

COMMIT;
