-- 114_repair_videos_episode_count_after_merge.sql
-- 描述：修复 videos.episode_count 落后于实际源集数的历史漂移——合并/拆分转移 source
--       后未推进 episode_count（FIX-MERGE-EPCOUNT），导致前台播放页/详情页选集丢集
--       （如「医到孤岛爱上你」合并后含 4 集线路仍只显示 2 集）。
--       口径与 024_backfill_videos_episode_count_from_sources.sql 完全一致（活跃非投稿源
--       MAX(COALESCE(episode_number, 1)) 高水位，单向递增），re-run 覆盖 024 后由合并/拆分
--       新引入的全部漂移视频。运行时侧已在 VideoMergesService merge/split 内补齐不变量。
-- 日期：2026-06-12
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
