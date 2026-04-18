-- 009_crawler_task_logs.sql
-- 描述：采集任务详细日志表（用于定位队列/抓取/入库故障）
-- 日期：2026-03
-- 幂等：是

CREATE TABLE IF NOT EXISTS crawler_task_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID        REFERENCES crawler_tasks(id) ON DELETE CASCADE,
  source_site TEXT,
  level       TEXT        NOT NULL DEFAULT 'info'
                          CHECK (level IN ('info', 'warn', 'error')),
  stage       TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crawler_task_logs_task_id
  ON crawler_task_logs(task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crawler_task_logs_source_site
  ON crawler_task_logs(source_site, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crawler_task_logs_created_at
  ON crawler_task_logs(created_at DESC);
