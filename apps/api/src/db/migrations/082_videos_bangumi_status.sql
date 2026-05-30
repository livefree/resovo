-- 082_videos_bangumi_status.sql
-- ADR-170 (C-1 / SEQ-20260529-02 / META-07)
--
-- 给 videos 增 bangumi_status 列，记 Bangumi 匹配态（动漫），与 douban_status（032）对称。
-- 由 BangumiService（matchAndEnrich / confirmMatch，C-2 接入）写入；非 anime 恒 'pending'。
-- 镜像 032 的 douban_status：4 态 CHECK + 部分索引（WHERE deleted_at IS NULL）。
--
-- 幂等：可重复执行（ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS）

BEGIN;

-- ── videos.bangumi_status ──────────────────────────────────────────
--   pending   = 入库后尚未执行 Bangumi 匹配（默认 / 非 anime 恒此值）
--   matched   = 已成功匹配 Bangumi 条目（auto 置信度 >= 0.85 或人工确认）
--   candidate = 有候选但置信度不足（0.60~0.85），需人工确认
--   unmatched = 匹配后无结果
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS bangumi_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (bangumi_status IN ('pending', 'matched', 'candidate', 'unmatched'));

-- bangumi_status 索引（审核台筛选用 / 镜像 idx_videos_douban_status）
CREATE INDEX IF NOT EXISTS idx_videos_bangumi_status
  ON videos (bangumi_status)
  WHERE deleted_at IS NULL;

-- ── 验证 ──────────────────────────────────────────────────────────

DO $$
DECLARE
  v_col_count INT;
  v_idx_count INT;
BEGIN
  SELECT COUNT(*) INTO v_col_count
  FROM information_schema.columns
  WHERE table_name = 'videos'
    AND column_name = 'bangumi_status';

  SELECT COUNT(*) INTO v_idx_count
  FROM pg_indexes
  WHERE tablename = 'videos'
    AND indexname = 'idx_videos_bangumi_status';

  IF v_col_count < 1 THEN
    RAISE EXCEPTION 'Migration 082: videos.bangumi_status 添加失败';
  END IF;

  IF v_idx_count < 1 THEN
    RAISE EXCEPTION 'Migration 082: idx_videos_bangumi_status 创建失败';
  END IF;

  RAISE NOTICE 'Migration 082 OK: videos.bangumi_status + idx_videos_bangumi_status';
END $$;

COMMIT;
