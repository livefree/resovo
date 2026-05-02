-- 060_admin_audit_log.sql
-- 描述：admin 写操作审计日志表（M-SN-2 欠账 + M-SN-4 前置补建）
-- 日期：2026-05-01
-- ADR：ADR-109（admin_audit_log schema 前置补建；M-SN-4 plan v1.2 §2.9 + §3.0.5）
-- 任务卡：CHG-SN-4-03 / SEQ-20260501-01
-- 幂等：是（CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS）
--
-- 部署顺序约束（plan v1.2 §2.10）：
--   060 必须先于 052–059 部署，确保 M-SN-4 写端点上线即可写入审计。
--
-- ⚠️  Down 路径说明（项目约定）：
--   scripts/migrate.ts 将整个文件内容作为单条 SQL 执行，不区分 up/down 节。
--   因此 down 路径必须保持注释形式，否则建表后立即被 DROP。
--   需要回滚时，手动解注释 down 节并在目标数据库独立执行（与 047/048/049 等迁移同约定）。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id            BIGSERIAL    PRIMARY KEY,
  actor_id      UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action_type   TEXT         NOT NULL,
  target_kind   TEXT         NOT NULL
                              CHECK (target_kind IN (
                                'video', 'video_source', 'staging',
                                'review_label', 'crawler_site', 'system'
                              )),
  target_id     UUID         NULL,
  before_jsonb  JSONB        NULL,
  after_jsonb   JSONB        NULL,
  request_id    TEXT         NULL,
  ip_hash       TEXT         NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE admin_audit_log
  IS 'admin 写操作审计日志；M-SN-4 D-18 前置补建（M-SN-2 欠账）；plan v1.2 §3.0.5 写入位点表为唯一真源';
COMMENT ON COLUMN admin_audit_log.actor_id
  IS '执行操作的 admin 用户 id（users.id）；ON DELETE RESTRICT 防止用户删除导致审计断链';
COMMENT ON COLUMN admin_audit_log.action_type
  IS '操作类型，例：video.approve / video.reject_labeled / video.staff_note / staging.publish；plan §3.0.5 表为枚举真源';
COMMENT ON COLUMN admin_audit_log.target_kind
  IS '目标对象种类；CHECK 约束限定 6 种，扩展须先改约束';
COMMENT ON COLUMN admin_audit_log.target_id
  IS '主体目标 id；NULL 仅用于 batch action（before/after_jsonb 中携带 ids 数组）';
COMMENT ON COLUMN admin_audit_log.before_jsonb
  IS '变更前关键字段快照；为可读性只存涉及字段子集，不强制全行快照';
COMMENT ON COLUMN admin_audit_log.after_jsonb
  IS '变更后关键字段快照；与 before_jsonb 字段对齐';
COMMENT ON COLUMN admin_audit_log.request_id
  IS 'pino request_id 透传（logging-rules.md）；用于跨服务追踪';
COMMENT ON COLUMN admin_audit_log.ip_hash
  IS 'hash(IP) 头 8 字节（PII 红线，logging-rules.md PII redact）；不存 IP 原值';

-- 主查询索引：按操作员近期记录回溯
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_created
  ON admin_audit_log (actor_id, created_at DESC);

-- 目标对象历史索引：按视频 / 线路 / staging 查整条历史
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target
  ON admin_audit_log (target_kind, target_id, created_at DESC);

-- 操作类型分布索引：审计统计 / 异常突发筛查
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action_created
  ON admin_audit_log (action_type, created_at DESC);

-- request_id 跨服务追踪（部分索引：仅非空才入）
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_request_id
  ON admin_audit_log (request_id)
  WHERE request_id IS NOT NULL;

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- DROP INDEX IF EXISTS idx_admin_audit_log_request_id;
-- DROP INDEX IF EXISTS idx_admin_audit_log_action_created;
-- DROP INDEX IF EXISTS idx_admin_audit_log_target;
-- DROP INDEX IF EXISTS idx_admin_audit_log_actor_created;
-- DROP TABLE IF EXISTS admin_audit_log;
-- COMMIT;
