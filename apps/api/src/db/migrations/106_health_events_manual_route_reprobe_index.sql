-- 106_health_events_manual_route_reprobe_index.sql
-- 描述：source_health_events 新增 manual_route_reprobe 待处理队列 partial index
-- 日期：2026-06-10
-- 方案真源：docs/designs/source-health-feedback-loop-plan_20260610.md §3 P2-4 ①
-- 任务卡：SRCHEALTH-P2-4-A / SEQ-20260610-02
-- 幂等：是（CREATE INDEX IF NOT EXISTS）
--
-- origin='manual_route_reprobe'（运营线路级重探信号，不复用 feedback_driven——
-- 避免混淆真实用户反馈与运营操作）；origin 列 037 起无 CHECK 约束，新值无需列迁移，
-- types union 真源 packages/types SourceHealthEventOriginWorker 同位扩展。
-- worker 拉取（P2-4-B）按本索引扫待处理信号，消费即 processed_at=NOW()（语义同 058a feedback_driven）。
--
-- ⚠️ 事务：由 scripts/migrate.ts 外层 BEGIN/COMMIT 包裹，本文件内不写 BEGIN/COMMIT
--    （内嵌 BEGIN 为既有技术债模式，105 起不复制——见 105 头注）。
-- ⚠️ Down 路径：注释形式留存（项目约定）。

CREATE INDEX IF NOT EXISTS idx_source_health_events_route_reprobe_unprocessed
  ON source_health_events (created_at)
  WHERE processed_at IS NULL AND origin = 'manual_route_reprobe';

-- ── down ─────────────────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS idx_source_health_events_route_reprobe_unprocessed;
