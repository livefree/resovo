-- Migration 074: crawler_runs.finished_at partial index
-- CW1-E-EP step 0.5 / ADR-152 Y-152-1
-- 用途：加速 source D（finished crawler_runs 按 finished_at 过滤）
--      partial index 仅含 finished_at IS NOT NULL 行（active runs 不写 finished_at，不浪费索引空间）
-- ROLLBACK 指令见文件底部

CREATE INDEX IF NOT EXISTS idx_crawler_runs_finished_at
  ON crawler_runs(finished_at DESC) WHERE finished_at IS NOT NULL;

-- ROLLBACK:
-- DROP INDEX IF EXISTS idx_crawler_runs_finished_at;
