-- 088_audit_log_extend_target_kind_identity_candidate.sql
-- ADR-178 D-178-6 / R-MID-1（CHG-VIR-9-B）
--
-- admin_audit_log.target_kind CHECK 约束扩展 14 → 15 种：
--   新增：identity_candidate（reject 端点单点 audit；targetId = candidateId）
--
-- 与 migration 072/073 同范式（ADR-144 / ADR-151 先例）

BEGIN;

ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_target_kind_check;
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_target_kind_check
  CHECK (target_kind IN (
    'video', 'video_source', 'staging', 'review_label', 'crawler_site', 'system',
    'home_module', 'source_line_alias', 'source_route', 'user_submission', 'image_health',
    'user', 'filter_preset', 'crawler_task', 'identity_candidate'
  ));

COMMENT ON COLUMN admin_audit_log.target_kind
  IS 'CHECK 限定 15 种（ADR-178 扩展 identity_candidate；14→15）';

COMMIT;
