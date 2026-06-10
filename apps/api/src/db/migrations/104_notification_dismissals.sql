-- 104_notification_dismissals.sql
-- ADR-197：通知/任务抽屉 dismiss（软移除）子系统 / SEQ-20260609-01 P3 / NTLG-NTF-DISMISS-A
--
-- notification_dismissals = per-user per-item 抽屉级软移除（视图态，非物理删除、非已读）。
--   item_key = 前端抽屉项最终 id 原值（D-197-2）：
--     - general notifications 行 id（纯数字串，如 '1042'）
--     - finished 高危审计 'bg-audit:<audit_log.id>'
--     - 终态任务 'taskrun-<task_runs.id>' / crawler run id
--   跨源统一 TEXT key，故**无 FK**（派生项 audit/task 无 notifications 行可挂）。
--   dismiss ≠ 物理删除（ADR-195 TTL purge 才物理删 notifications）；
--   dismiss ≠ 已读（ADR-192 cursor/reads 不受影响，D-197-5）。
--   清理走 ADR-195 purge worker 扩展 deleteStaleDismissals（age N≥90d，D-197-6），非 FK CASCADE。
--
-- ⚠️  Down 路径说明（项目约定）：scripts/migrate.ts 整文件单条执行，不区分 up/down；
--     down 保持注释，回滚时手动解注释独立执行（与 094–103 同约定）。

-- ── up ───────────────────────────────────────────────────────────────────────
BEGIN;

CREATE TABLE IF NOT EXISTS notification_dismissals (
  user_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 抽屉项最终 id 原值（跨源统一 TEXT，无 FK；D-197-2）
  item_key      TEXT          NOT NULL,
  dismissed_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  -- 同一用户同一抽屉项最多一条；幂等 dismiss（重复 dismiss ON CONFLICT DO NOTHING）
  PRIMARY KEY (user_id, item_key)
);

-- 索引设计 4 步核验（db-rules §索引设计）：
-- ① 索引键：PK (user_id, item_key) — 复合，前缀 user_id 等值 + item_key 等值。
-- ② 全表索引（无 WHERE）：覆盖全部行，无反向条件 invariant。
-- ③ driving 谓词：(a) drawer list NOT EXISTS(user_id=$k AND item_key=notifications.id::text) 点查；
--    (b) selectDismissedKeys WHERE user_id=$1（前缀等值 → 取该 user 全部 dismissals）；
--    (c) dismiss upsert ON CONFLICT(user_id,item_key)。三者均以 user_id 为前导列，PK 复合键完全支撑。
-- ④ 不补二级索引：item_key 单独查（无 user_id）无业务路径；deleteStaleDismissals 按 dismissed_at 范围扫——
--    量级小（per-user 抽屉项有限），全表 seq scan 可接受，不补 (dismissed_at) 索引
--    （对齐 ADR-192 D-192-4「不补 anti-join 索引」克制原则；日后膨胀再评估）。
COMMENT ON TABLE notification_dismissals
  IS '抽屉级软移除 per-user per-item（ADR-197）；item_key=抽屉项最终 id 原值跨源 TEXT 无 FK；dismiss≠物理删除（ADR-195 purge）≠已读（ADR-192 cursor/reads）；清理走 purge worker age N≥90d';

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────
-- BEGIN;
-- DROP TABLE IF EXISTS notification_dismissals;
-- COMMIT;
