-- 012_add_task_started_at.sql
-- 描述：为 crawler_tasks 增加 started_at 字段，记录任务实际进入 running 状态的时间
-- 日期：2026-03
-- 幂等：是

ALTER TABLE crawler_tasks
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
