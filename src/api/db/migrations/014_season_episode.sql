-- 014_season_episode.sql
-- 描述：Season/Episode 统一坐标系（ADR-016）
--   - video_sources：新增 season_number，episode_number NULL→NOT NULL DEFAULT 1
--   - watch_history：同上
-- 日期：2026-03
-- 依赖：013_type_expansion.sql
-- 幂等：是（ADD COLUMN IF NOT EXISTS；UPDATE 幂等；ALTER NOT NULL 幂等）
-- 回滚注意：episode_number 的 NULL→1 迁移不可逆（无法区分原本是 NULL 还是 1），
--           执行前请备份相关列

BEGIN;

-- ── video_sources ──────────────────────────────────────────────────

ALTER TABLE video_sources
  ADD COLUMN IF NOT EXISTS season_number INT NOT NULL DEFAULT 1;

-- 将现有 episode_number IS NULL 填为 1
UPDATE video_sources SET episode_number = 1 WHERE episode_number IS NULL;

ALTER TABLE video_sources
  ALTER COLUMN episode_number SET NOT NULL,
  ALTER COLUMN episode_number SET DEFAULT 1;

-- ── watch_history ─────────────────────────────────────────────────

ALTER TABLE watch_history
  ADD COLUMN IF NOT EXISTS season_number INT NOT NULL DEFAULT 1;

-- 将现有 episode_number IS NULL 填为 1
UPDATE watch_history SET episode_number = 1 WHERE episode_number IS NULL;

ALTER TABLE watch_history
  ALTER COLUMN episode_number SET NOT NULL,
  ALTER COLUMN episode_number SET DEFAULT 1;

COMMIT;
