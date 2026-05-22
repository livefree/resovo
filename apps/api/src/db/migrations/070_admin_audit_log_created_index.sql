-- 070_admin_audit_log_created_index.sql
-- ADR-141 / CHG-SN-8-FUP-DASH-ACTIVITY-LIVE
--
-- admin_audit_log 新增 (created_at DESC) 单列索引：
--   支撑 dashboard activities 端点 ORDER BY created_at DESC LIMIT N 全局时间倒序扫描。
--   现有 4 索引（actor_id+created / target_kind+target_id+created /
--   action_type+created / request_id partial）前导列均不固定，
--   不能直接服务无过滤的时间倒序查询。
--
-- 详见 ADR-141 §D-141-5 性能优化 + §10 R-141-1 索引代价评估
-- （日写 ~100-500 行，10 万行 ~2.4MB；写入开销可忽略 / 查询 p95 < 10ms）

BEGIN;

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created
  ON admin_audit_log (created_at DESC);

COMMENT ON INDEX idx_admin_audit_log_created
  IS 'dashboard activities 端点 ORDER BY created_at DESC LIMIT N 专用（ADR-141 D-141-5）；支撑全局时间倒序扫描场景';

COMMIT;
