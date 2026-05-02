-- 058_source_health_events_line_detail.sql
-- 描述：source_health_events 扩展 — 关联单条线路 + 错误细节，支持"证据"面板按线路查询健康历史
-- 日期：2026-05-01
-- ADR：ADR-109 关联 / M-SN-4 plan v1.3 §2.7
-- 任务卡：CHG-SN-4-03 / SEQ-20260501-01
-- 幂等：是（ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS）
--
-- 037 既有字段保持不变：id / video_id / origin / old_status / new_status / triggered_by / created_at
-- 058 新增 4 列：
--   source_id    UUID NULL REFERENCES video_sources(id) ON DELETE CASCADE
--   error_detail TEXT NULL（HTTP 状态码 / 错误类型 / manifest parse 失败原因）
--   http_code    INT NULL
--   latency_ms   INT NULL
-- source_id 可空：兼容存量行（037 时只有 video_id）；新行由 worker / feedback 写入时尽量填。
--
-- ⚠️  Down 路径说明（项目约定）：注释形式留存。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE source_health_events
  ADD COLUMN IF NOT EXISTS source_id    UUID REFERENCES video_sources(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS error_detail TEXT,
  ADD COLUMN IF NOT EXISTS http_code    INT,
  ADD COLUMN IF NOT EXISTS latency_ms   INT;

COMMENT ON COLUMN source_health_events.source_id
  IS '关联单条线路（video_sources.id）；058 新增；存量行 NULL 兼容；新行由 worker / feedback 写入';
COMMENT ON COLUMN source_health_events.error_detail
  IS '错误细节文案（HTTP 状态码 / 错误类型 / manifest parse 失败原因）';
COMMENT ON COLUMN source_health_events.http_code
  IS 'HTTP 响应码；NULL 表示非 HTTP 错误（如 manifest parse 失败）';
COMMENT ON COLUMN source_health_events.latency_ms
  IS '响应延迟毫秒；NULL 表示请求未发出（如熔断跳过）';

-- "证据"面板按 source_id 查询健康历史（partial index：仅非空入索引）
CREATE INDEX IF NOT EXISTS idx_source_health_events_source_id
  ON source_health_events (source_id, created_at DESC)
  WHERE source_id IS NOT NULL;

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- DROP INDEX IF EXISTS idx_source_health_events_source_id;
-- ALTER TABLE source_health_events
--   DROP COLUMN IF EXISTS latency_ms,
--   DROP COLUMN IF EXISTS http_code,
--   DROP COLUMN IF EXISTS error_detail,
--   DROP COLUMN IF EXISTS source_id;
-- COMMIT;
