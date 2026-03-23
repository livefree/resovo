-- 013_type_expansion.sql
-- 描述：视频类型枚举从 4 种扩展为 12 种；数据迁移 series→drama；新增类型判定辅助字段
-- 日期：2026-03
-- 依赖：无
-- 幂等：是（ADD COLUMN IF NOT EXISTS；约束删除前检查是否存在）

BEGIN;

-- ── 1. 扩展 type 枚举约束 ─────────────────────────────────────────

ALTER TABLE videos
  DROP CONSTRAINT IF EXISTS videos_type_check;

ALTER TABLE videos
  ADD CONSTRAINT videos_type_check
    CHECK (type IN (
      'movie',
      'drama',
      'anime',
      'variety',
      'short_drama',
      'sports',
      'music',
      'documentary',
      'game_show',
      'news',
      'children',
      'other'
    ));

-- ── 2. 数据迁移：series → drama ───────────────────────────────────

UPDATE videos SET type = 'drama' WHERE type = 'series';

-- ── 3. 新增类型判定辅助字段 ───────────────────────────────────────

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS source_content_type TEXT,
  ADD COLUMN IF NOT EXISTS normalized_type TEXT,
  ADD COLUMN IF NOT EXISTS content_format TEXT
    CHECK (content_format IN ('movie', 'episodic', 'collection', 'clip')),
  ADD COLUMN IF NOT EXISTS episode_pattern TEXT
    CHECK (episode_pattern IN ('single', 'multi', 'ongoing', 'unknown'));

COMMIT;
