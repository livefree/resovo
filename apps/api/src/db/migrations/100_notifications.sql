-- 100_notifications.sql
-- ADR-192：通知与审计解耦双写 + 通知独立存储 + 已读混合模型
-- NTLG-P1-a-A / SEQ-20260609-01
--
-- notifications = 通知独立真源（脱离 admin_audit_log 派生，D-192-1/D-192-2）。
--   level 三值 DB CHECK 收口（D-192-6，对齐 AdminNotificationItem.level）；
--   scope 无 CHECK（类型层前缀校验 broadcast/role:*/user:*，保 user:<id> 定向扩展，D-192-6）；
--   dedup_key partial unique 幂等（防 60s 轮询 / worker 重试重复 emit，D-192-2）；
--   payload JSONB 承载结构化数据（TaskResultDigest 等，形状归 ADR-193）；
--   expires_at TTL 保留期（数值策略归 ADR-195，本卡仅保字段 + 参与未读过滤）。
-- notification_read_cursor = broadcast/role 已读高水位线（per-user 一行，替代 localStorage lastViewedAt，D-192-3）。
--   read_at 之前的 broadcast/role 通知视为已读；新用户初值=加入时间（users.created_at，不回溯历史，由 -B upsert 写入）。
-- notification_reads = 定向通知逐行已读（P1 仅建表预留；写路径随 P2 定向能力落地，D-192-3 / D-192-DEV-1）。
--
-- ⚠️  Down 路径说明（项目约定）：scripts/migrate.ts 整文件单条执行，不区分 up/down；
--     down 保持注释，回滚时手动解注释独立执行（与 094–099 同约定）。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS notifications (
  id           BIGSERIAL     PRIMARY KEY,
  -- 语义键（如 'crawler.run.completed' / 'submission.created' / 'webhook.failed'）
  type         TEXT          NOT NULL,
  -- 三值收口（DB CHECK，对齐 AdminNotificationItem.level，D-192-6）
  level        TEXT          NOT NULL CHECK (level IN ('info', 'warn', 'danger')),
  title        TEXT          NOT NULL,
  body         TEXT,
  -- 结构化数据（TaskResultDigest 等，形状归 ADR-193；已 strip comments 由消费方保证）
  payload      JSONB,
  -- 点击跳转
  href         TEXT,
  -- 产出象限（'task' | 'system' | 'moderation' | 'submission' | ...，emit 必填）
  source_kind  TEXT          NOT NULL,
  -- 关联实体 id（run_id / submission_id；去重&反查）
  source_ref   TEXT,
  -- 幂等键（防轮询 / worker 重试重复 emit；NULL 不参与唯一约束，见 partial unique index）
  dedup_key    TEXT,
  -- 投递范围（'broadcast' | 'role:<r>' | 'user:<id>'；无 CHECK，类型层前缀校验，D-192-6）
  scope        TEXT          NOT NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  -- TTL 保留期（数值策略归 ADR-195；参与未读过滤 D-192-5）
  expires_at   TIMESTAMPTZ
);

-- 索引设计 4 步核验（db-rules §索引设计）：
-- ① 索引键：(created_at DESC) — 支撑通知列表「按时间倒序分页」（GET /admin/notifications 默认排序）。
-- ② 全表索引（无 WHERE）：覆盖全部行，无反向条件 invariant。
-- ③ driving 谓词：ORDER BY created_at DESC + LIMIT（list 主查询）；非等值过滤，DESC 方向匹配。
-- ④ 与 ②(scope,created_at) 区隔：本索引服务「全 scope 混合时间线」（理论上 list 一般带 scope 过滤走 ②，
--    但保留全表时间序索引兜底无 scope 过滤 / 维护清理按 created_at 扫描场景）。
CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON notifications (created_at DESC);

-- 索引设计 4 步核验：
-- ① 索引键：(scope, created_at) — 复合，前缀 scope 等值 + created_at 范围。
-- ② 全表索引（无 WHERE）：覆盖全部行，无反向条件 invariant。
-- ③ driving 谓词：unread-count 的「scope 命中（=ANY broadcast/role_scopes）AND created_at > cursor.read_at」
--    范围扫描（D-192-5 broadcast/role 未读口径）；scope 等值定位 + created_at 范围裁剪，复合键完全支撑。
-- ④ 不补 anti-join 索引（D-192-4）：cursor 把「全体已读」压成一行高水位，范围扫描随表增长稳定，
--    无需 notifications LEFT JOIN reads 的反连接索引（那会全表扫 + 大 join 退化）。
CREATE INDEX IF NOT EXISTS idx_notifications_scope_created_at
  ON notifications (scope, created_at);

-- 索引设计 4 步核验：
-- ① 索引键：(dedup_key) — partial unique。
-- ② 部分索引 WHERE：dedup_key IS NOT NULL —— 仅幂等键非空的通知纳入唯一约束；
--    反向 invariant：dedup_key IS NULL 的通知（无幂等需求）不受唯一约束，可自由重复插入。
-- ③ driving 谓词：emit 的 INSERT ... ON CONFLICT (dedup_key) DO NOTHING（幂等去重，D-192-2 / ADR-193 D-193-2）。
-- ④ partial 而非全表 unique：NULL 值在 unique 索引中互不冲突，但用 partial 显式排除 NULL 行更省空间且语义清晰。
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_dedup_key
  ON notifications (dedup_key) WHERE dedup_key IS NOT NULL;

COMMENT ON TABLE notifications
  IS '通知独立真源（ADR-192）；脱离 admin_audit_log 派生、解耦双写；level 三值 CHECK / scope 类型层前缀校验 / dedup_key partial unique 幂等 / payload 承载 TaskResultDigest（ADR-193）/ expires_at TTL（策略 ADR-195）';

-- broadcast/role 已读高水位线（per-user 一行；D-192-3）
CREATE TABLE IF NOT EXISTS notification_read_cursor (
  user_id  UUID          PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- 此刻之前的 broadcast/role 通知视为已读；新用户初值=加入时间（users.created_at，-B upsert 写入，不回溯历史）
  read_at  TIMESTAMPTZ   NOT NULL
);

COMMENT ON TABLE notification_read_cursor
  IS 'broadcast/role 已读高水位线（ADR-192 D-192-3）；per-user 一行替代 localStorage lastViewedAt；markAllRead 仅 upsert 一行避免写放大；新用户初值=加入时间不回溯历史';

-- 定向通知逐行已读（P1 仅建表预留；写路径随 P2 定向能力落地，D-192-3 / D-192-DEV-1）
CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id  BIGINT        NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id          UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  -- 复合 PK 支撑 unread-count 定向项 NOT EXISTS 点查（D-192-4/5）+ markOneRead 例外位
  PRIMARY KEY (notification_id, user_id)
);

COMMENT ON TABLE notification_reads
  IS '定向通知逐行已读 + broadcast 单条已读例外位（ADR-192 D-192-3 / D-192-DEV-1）；P1 仅建表预留，写路径随 P2 定向能力落地；PK(notification_id,user_id) 支撑 unread NOT EXISTS 点查';

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- DROP TABLE IF EXISTS notification_reads;
-- DROP TABLE IF EXISTS notification_read_cursor;
-- DROP TABLE IF EXISTS notifications;
-- COMMIT;
