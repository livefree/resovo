-- Migration 015: content_format / episode_pattern 数据回填
-- CHG-172: 对 Migration 013 已建立的字段进行存量数据推断写入
-- 推断规则（ADR-017）：
--   type='movie' OR episode_count=1  → content_format='movie',  episode_pattern='single'
--   episode_count>1 AND status='completed' → content_format='episodic', episode_pattern='multi'
--   episode_count>1 AND status='ongoing'   → content_format='episodic', episode_pattern='ongoing'
--   其他                                   → content_format='episodic', episode_pattern='unknown'

BEGIN;

-- 电影或单集
UPDATE videos
SET
  content_format  = 'movie',
  episode_pattern = 'single'
WHERE (type = 'movie' OR episode_count <= 1)
  AND (content_format IS NULL OR episode_pattern IS NULL);

-- 多集已完结
UPDATE videos
SET
  content_format  = 'episodic',
  episode_pattern = 'multi'
WHERE episode_count > 1
  AND status = 'completed'
  AND type != 'movie'
  AND (content_format IS NULL OR episode_pattern IS NULL);

-- 多集连载中
UPDATE videos
SET
  content_format  = 'episodic',
  episode_pattern = 'ongoing'
WHERE episode_count > 1
  AND status = 'ongoing'
  AND type != 'movie'
  AND (content_format IS NULL OR episode_pattern IS NULL);

-- 其余兜底（多集但状态不明确）
UPDATE videos
SET
  content_format  = 'episodic',
  episode_pattern = 'unknown'
WHERE episode_count > 1
  AND type != 'movie'
  AND (content_format IS NULL OR episode_pattern IS NULL);

COMMIT;
