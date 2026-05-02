-- 058a_source_health_events_processed_at.sql
-- 描述：source_health_events 新增 processed_at 列 + partial index（feedback 入队信号产生方）
-- 日期：2026-05-02
-- ADR：ADR-109 关联 / M-SN-4-05 plan §1.4
-- 任务卡：CHG-SN-4-05
-- 编号说明：058a 是字母后缀编号（已有 058 + 059 + 060）；runner 字典序 058 < 058a < 059，
--           部署顺序天然正确，不破坏 -03 已固化部署顺序。
-- 幂等：是（ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS）
--
-- 新增 1 列：
--   processed_at  TIMESTAMPTZ NULL（feedback-driven recheck queue 消费标记；
--                 NULL = 未处理；非 NULL = worker 已入队）
--
-- 部分索引（partial index）：仅 origin='feedback_driven' AND processed_at IS NULL 行入索引，
-- CHG-SN-4-06 worker 按此索引拉取待处理队列信号。
--
-- ⚠️  Down 路径说明（项目约定）：注释形式留存。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE source_health_events
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN source_health_events.processed_at
  IS 'feedback-driven recheck queue 消费标记；NULL = 未处理；非 NULL = worker 已入队；CHG-SN-4-05 §1.4';

CREATE INDEX IF NOT EXISTS idx_source_health_events_unprocessed
  ON source_health_events (created_at)
  WHERE processed_at IS NULL AND origin = 'feedback_driven';

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- DROP INDEX IF EXISTS idx_source_health_events_unprocessed;
-- ALTER TABLE source_health_events
--   DROP COLUMN IF EXISTS processed_at;
-- COMMIT;
