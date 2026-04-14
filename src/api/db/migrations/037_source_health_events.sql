-- migration: 037_source_health_events
-- CHG-388: 失效源状态变更事件表
-- 用途：记录孤岛检测触发的 unpublish/refetch 事件，供孤岛视频 Tab 查询

CREATE TABLE IF NOT EXISTS source_health_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id      UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  origin        TEXT NOT NULL,   -- 'island_detected' | 'auto_refetch_success' | 'auto_refetch_failed'
  old_status    TEXT,            -- 操作前 visibility_status / source_check_status
  new_status    TEXT,            -- 操作后状态
  triggered_by  TEXT,            -- 触发来源（'maintenance_worker' | 'manual'）
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_health_events_video_id
  ON source_health_events (video_id);

CREATE INDEX IF NOT EXISTS idx_source_health_events_created_at
  ON source_health_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_source_health_events_origin
  ON source_health_events (origin);
