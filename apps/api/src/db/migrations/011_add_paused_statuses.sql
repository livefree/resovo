-- 011_add_paused_statuses.sql
-- 描述：扩展 run/task 状态模型，增加 paused 状态
-- 日期：2026-03
-- 幂等：是

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'crawler_tasks_status_check'
      AND conrelid = 'crawler_tasks'::regclass
  ) THEN
    ALTER TABLE crawler_tasks DROP CONSTRAINT crawler_tasks_status_check;
  END IF;
END $$;

ALTER TABLE crawler_tasks
  ADD CONSTRAINT crawler_tasks_status_check
  CHECK (status IN ('pending', 'running', 'paused', 'done', 'failed', 'cancelled', 'timeout'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'crawler_runs_status_check'
      AND conrelid = 'crawler_runs'::regclass
  ) THEN
    ALTER TABLE crawler_runs DROP CONSTRAINT crawler_runs_status_check;
  END IF;
END $$;

ALTER TABLE crawler_runs
  ADD CONSTRAINT crawler_runs_status_check
  CHECK (status IN ('queued', 'running', 'paused', 'success', 'partial_failed', 'failed', 'cancelled'));
