-- 054_video_sources_signal_columns.sql
-- 描述：video_sources 新增每条线路独立的 probe / render 信号列（双轨健康验证）
-- 日期：2026-05-01
-- ADR：ADR-109 关联 / M-SN-4 plan v1.4 §2.3
-- 任务卡：CHG-SN-4-03 / SEQ-20260501-01
-- 幂等：是（ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS）
--
-- 新增 5 列：
--   probe_status     TEXT NOT NULL DEFAULT 'pending' CHECK (4 值)
--   render_status    TEXT NOT NULL DEFAULT 'pending' CHECK (4 值)
--   latency_ms       INT NULL（首次 SourceHealthWorker 运行后填）
--   last_probed_at   TIMESTAMPTZ NULL
--   last_rendered_at TIMESTAMPTZ NULL
--
-- 存量行回填（从 videos.source_check_status 粗粒度推导）：
--   ok       → probe_status=ok（is_active 维度独立）
--   partial  → is_active TRUE → ok / FALSE → dead
--   all_dead → dead
--   pending  → pending（默认值）
-- 精确值由 SourceHealthWorker（CHG-SN-4-06）首次运行后写回。
--
-- ⚠️  Down 路径说明（项目约定）：注释形式留存。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE video_sources
  ADD COLUMN IF NOT EXISTS probe_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (probe_status IN ('pending', 'ok', 'partial', 'dead')),
  ADD COLUMN IF NOT EXISTS render_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (render_status IN ('pending', 'ok', 'partial', 'dead')),
  ADD COLUMN IF NOT EXISTS latency_ms       INT,
  ADD COLUMN IF NOT EXISTS last_probed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_rendered_at TIMESTAMPTZ;

COMMENT ON COLUMN video_sources.probe_status
  IS '探测态（reachability，HEAD / m3u8 manifest）；CHECK 4 值；M-SN-4 plan v1.4 §2.3';
COMMENT ON COLUMN video_sources.render_status
  IS '渲染态（playability，manifest parse + segment 验证）；CHECK 4 值；同上';
COMMENT ON COLUMN video_sources.latency_ms
  IS '首个 segment / manifest 响应时间，毫秒；NULL 表示尚未测量';
COMMENT ON COLUMN video_sources.last_probed_at
  IS 'Level 1 probe 最后执行时间';
COMMENT ON COLUMN video_sources.last_rendered_at
  IS 'Level 2 render check 最后执行时间';

-- 存量数据粗粒度回填
UPDATE video_sources vs
SET probe_status = CASE v.source_check_status
  WHEN 'ok'       THEN 'ok'
  WHEN 'partial'  THEN CASE WHEN vs.is_active THEN 'ok' ELSE 'dead' END
  WHEN 'all_dead' THEN 'dead'
  ELSE 'pending'
END
FROM videos v
WHERE v.id = vs.video_id
  AND vs.deleted_at IS NULL
  AND vs.probe_status = 'pending';  -- 仅回填默认值未变的存量行

-- 主查询索引：审核台 / Drawer 按 probe_status 筛选
CREATE INDEX IF NOT EXISTS idx_video_sources_probe_status
  ON video_sources(probe_status)
  WHERE deleted_at IS NULL AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_video_sources_render_status
  ON video_sources(render_status)
  WHERE deleted_at IS NULL;

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- DROP INDEX IF EXISTS idx_video_sources_render_status;
-- DROP INDEX IF EXISTS idx_video_sources_probe_status;
-- ALTER TABLE video_sources
--   DROP COLUMN IF EXISTS last_rendered_at,
--   DROP COLUMN IF EXISTS last_probed_at,
--   DROP COLUMN IF EXISTS latency_ms,
--   DROP COLUMN IF EXISTS render_status,
--   DROP COLUMN IF EXISTS probe_status;
-- COMMIT;
