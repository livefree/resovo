-- 103_task_runs_status_cancelling.sql
-- ADR-194 D-194-DEV-4：补 task_runs.status CHECK 第 6 态 'cancelling'（协作式取消中间态）
-- NTLG-P2-a-A 修正 / SEQ-20260609-01
--
-- 背景（Codex stop-time review 抓出运维缺陷）：102_task_runs.sql 原 status CHECK 仅 5 态
--   （pending/running/success/failed/cancelled），与 ADR-194 D-194-6 协作式取消「复用
--   status='cancelling' 中间态」（running→cancelling→cancelled，bull worker 轮询信号）矛盾。
--   102 已就地补为 6 态（令 fresh DB 直接正确），但**已应用过旧版 102 的数据库**
--   （schema_migrations 已记录 102 applied）会被 migrate 跳过、`CREATE TABLE IF NOT EXISTS` 不 ALTER
--   既有约束 → 永远拿不到 6 态修复。本 forward migration 幂等 ALTER 约束，令任何库收敛 6 态。
--
-- 幂等：DROP CONSTRAINT IF EXISTS + ADD —— fresh DB（102 已 6 态）重申无副作用 / 旧 DB（5 态）修复为 6 态。
--   既有数据 status 值恒在 5 态子集内，ADD 6 态约束（超集）不会因既有行失败。
--   约束名 task_runs_status_check = PG 对 102 inline 列 CHECK 的标准自动命名（已实测核对）。
--
-- ⚠️  Down 路径说明（项目约定）：scripts/migrate.ts 整文件单条执行，不区分 up/down；
--     down 保持注释，回滚时手动解注释独立执行（与 094–102 同约定）。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE task_runs DROP CONSTRAINT IF EXISTS task_runs_status_check;
ALTER TABLE task_runs ADD CONSTRAINT task_runs_status_check
  CHECK (status IN ('pending', 'running', 'cancelling', 'success', 'failed', 'cancelled'));

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- ALTER TABLE task_runs DROP CONSTRAINT IF EXISTS task_runs_status_check;
-- ALTER TABLE task_runs ADD CONSTRAINT task_runs_status_check
--   CHECK (status IN ('pending', 'running', 'success', 'failed', 'cancelled'));
-- COMMIT;
