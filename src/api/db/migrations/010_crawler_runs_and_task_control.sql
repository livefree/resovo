-- 010_crawler_runs_and_task_control.sql
-- 描述：采集批次模型 + 任务控制字段（批量/全部/定时/取消/超时）
-- 日期：2026-03
-- 幂等：是

CREATE TABLE IF NOT EXISTS crawler_runs (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type          TEXT        NOT NULL
                                    CHECK (trigger_type IN ('single', 'batch', 'all', 'schedule')),
  mode                  TEXT        NOT NULL
                                    CHECK (mode IN ('incremental', 'full')),
  status                TEXT        NOT NULL DEFAULT 'queued'
                                    CHECK (status IN ('queued', 'running', 'success', 'partial_failed', 'failed', 'cancelled')),
  control_status        TEXT        NOT NULL DEFAULT 'active'
                                    CHECK (control_status IN ('active', 'pausing', 'paused', 'cancelling', 'cancelled')),
  requested_site_count  INT         NOT NULL DEFAULT 0,
  enqueued_site_count   INT         NOT NULL DEFAULT 0,
  skipped_site_count    INT         NOT NULL DEFAULT 0,
  timeout_seconds       INT         NOT NULL DEFAULT 900,
  created_by            UUID        REFERENCES users(id) ON DELETE SET NULL,
  schedule_id           TEXT,
  summary               JSONB,
  started_at            TIMESTAMPTZ,
  finished_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crawler_runs_created_at
  ON crawler_runs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crawler_runs_status
  ON crawler_runs(status, created_at DESC);

ALTER TABLE crawler_tasks
  ADD COLUMN IF NOT EXISTS run_id UUID REFERENCES crawler_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trigger_type TEXT
    CHECK (trigger_type IN ('single', 'batch', 'all', 'schedule')),
  ADD COLUMN IF NOT EXISTS timeout_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_requested BOOLEAN NOT NULL DEFAULT false;

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
  CHECK (status IN ('pending', 'running', 'done', 'failed', 'cancelled', 'timeout'));

CREATE INDEX IF NOT EXISTS idx_crawler_tasks_run_id
  ON crawler_tasks(run_id, scheduled_at DESC);

CREATE INDEX IF NOT EXISTS idx_crawler_tasks_timeout_at
  ON crawler_tasks(timeout_at)
  WHERE status IN ('pending', 'running');
