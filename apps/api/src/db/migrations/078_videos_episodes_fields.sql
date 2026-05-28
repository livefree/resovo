-- Migration 078: videos.total_episodes + current_episodes（ADR-163 / CHG-367-B-A / plan §10.4.4）
--
-- 背景：plan §10.4.4 / ADR-163 META-EPISODES 三层集数语义拆分。
-- 既有 `episode_count`（Migration 001 / 爬虫推算"已收录最大集数"）保留不动；
-- 新增两个 INT 字段承载外部 metadata 真源的"已播 / 共有"集数（豆瓣 subject /
-- bangumi infobox）。详 ADR-163 D-163-1..8 + §4 schema 设计。
--
-- 字段约定（详 ADR-163 §3）：
--   total_episodes   INT NULL — 作品总集数（完结后定值 / 连载中可能为 NULL 或预告值）
--   current_episodes INT NULL — 当前已播集数（连载中持续更新）
--
-- NULL 语义（D-163-3）：未从外部 metadata 取到 / 电影类型保持 NULL / 0 不使用
-- 完结态联动（D-163-4）：DB 层不做自动联动；UI 显示层处理
-- 写入路径（D-163-6）：MetadataEnrichService auto + DoubanService manual
-- audit RETRO（D-163-7）：不触发 R-MID-1（无新 admin 写端点）
--
-- 幂等：ADD COLUMN IF NOT EXISTS / ADD CONSTRAINT IF NOT EXISTS 可重复执行。

BEGIN;

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS total_episodes   INT NULL,
  ADD COLUMN IF NOT EXISTS current_episodes INT NULL;

-- CHECK 约束：集数必须正整数（NULL 合法 / 0 和负数不合法 / D-163-3 NULL 语义）
-- 不加 (total >= current) 不变式：外部数据不可控（D-163-3 + §11 Y1 / DB 层不强制业务不变式）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chk_total_episodes_positive' AND table_name = 'videos'
  ) THEN
    ALTER TABLE videos
      ADD CONSTRAINT chk_total_episodes_positive
        CHECK (total_episodes IS NULL OR total_episodes > 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chk_current_episodes_positive' AND table_name = 'videos'
  ) THEN
    ALTER TABLE videos
      ADD CONSTRAINT chk_current_episodes_positive
        CHECK (current_episodes IS NULL OR current_episodes > 0);
  END IF;
END $$;

-- 部分索引：仅对有外部集数信息的行建索引（审核台"已获取集数"筛选）
CREATE INDEX IF NOT EXISTS idx_videos_total_episodes
  ON videos (total_episodes)
  WHERE total_episodes IS NOT NULL;

-- ── 验证 ──────────────────────────────────────────────────────────

DO $$
DECLARE
  v_col_count INT;
BEGIN
  SELECT COUNT(*) INTO v_col_count
  FROM information_schema.columns
  WHERE table_name = 'videos'
    AND column_name IN ('total_episodes', 'current_episodes');

  IF v_col_count <> 2 THEN
    RAISE EXCEPTION 'Migration 078: videos.total_episodes/current_episodes 添加失败，期望 2，实际 %', v_col_count;
  END IF;

  RAISE NOTICE 'Migration 078 OK: videos.total_episodes + current_episodes added';
END $$;

COMMIT;

-- ROLLBACK SQL（与 Migration 077 同范式 / NULL default 删除安全）:
-- ALTER TABLE videos DROP CONSTRAINT IF EXISTS chk_total_episodes_positive;
-- ALTER TABLE videos DROP CONSTRAINT IF EXISTS chk_current_episodes_positive;
-- DROP INDEX IF EXISTS idx_videos_total_episodes;
-- ALTER TABLE videos DROP COLUMN IF EXISTS total_episodes;
-- ALTER TABLE videos DROP COLUMN IF EXISTS current_episodes;
