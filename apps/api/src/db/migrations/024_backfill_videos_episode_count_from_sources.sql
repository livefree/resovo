-- 024_backfill_videos_episode_count_from_sources.sql
-- 描述：回填 videos.episode_count，修复历史上主表集数小于实际源集数的漂移
-- 日期：2026-04-02
-- 幂等：是（仅当 max_episode > episode_count 时更新）

WITH source_max_episode AS (
  SELECT
    s.video_id,
    MAX(COALESCE(s.episode_number, 1))::int AS max_episode
  FROM video_sources s
  WHERE s.deleted_at IS NULL
    AND s.submitted_by IS NULL
  GROUP BY s.video_id
)
UPDATE videos v
SET episode_count = source_max_episode.max_episode,
    updated_at = NOW()
FROM source_max_episode
WHERE v.id = source_max_episode.video_id
  AND v.deleted_at IS NULL
  AND source_max_episode.max_episode > v.episode_count;
