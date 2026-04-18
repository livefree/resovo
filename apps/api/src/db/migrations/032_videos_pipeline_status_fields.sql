-- 032_videos_pipeline_status_fields.sql
-- Pipeline Overhaul (SEQ-20260409-01 CHG-381)
-- 为采集→上架流水线新增辅助状态字段
-- 幂等：可重复执行（IF NOT EXISTS / DO NOTHING）

BEGIN;

-- ── videos 表：流水线辅助字段 ──────────────────────────────────────

-- douban_status：自动丰富 Job 写入的豆瓣匹配状态
--   pending   = 入库后尚未执行丰富 Job
--   matched   = 已成功匹配豆瓣条目（置信度 >= 0.75 或本地 dump 精确命中）
--   candidate = 有候选但置信度不足（0.45~0.75），需人工确认
--   unmatched = 搜索后无法匹配
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS douban_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (douban_status IN ('pending', 'matched', 'candidate', 'unmatched'));

-- source_check_status：源活性批量检验结果
--   pending   = 尚未执行检验
--   ok        = 全部源可达
--   partial   = 部分源可达
--   all_dead  = 所有源均失效
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS source_check_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (source_check_status IN ('pending', 'ok', 'partial', 'all_dead'));

-- meta_score：元数据完整度评分（0-100），由丰富 Job 计算
--   title(20) + cover_url(20) + description(20) + genres(20) + year(10) + type(10)
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS meta_score SMALLINT NOT NULL DEFAULT 0
    CHECK (meta_score BETWEEN 0 AND 100);

-- 为暂存队列查询（approved+internal + 就绪判断）建立复合索引
CREATE INDEX IF NOT EXISTS idx_videos_staging
  ON videos (review_status, visibility_status, is_published)
  WHERE deleted_at IS NULL;

-- douban_status 索引（审核台筛选用）
CREATE INDEX IF NOT EXISTS idx_videos_douban_status
  ON videos (douban_status)
  WHERE deleted_at IS NULL;

-- ── crawler_runs 表：采集模式扩展字段 ────────────────────────────────

-- crawl_mode：区分三种采集模式
--   batch          = 定时批量采集（现有默认）
--   keyword        = 关键词搜索采集（新增）
--   source-refetch = 单视频补源采集（新增）
ALTER TABLE crawler_runs
  ADD COLUMN IF NOT EXISTS crawl_mode TEXT NOT NULL DEFAULT 'batch'
    CHECK (crawl_mode IN ('batch', 'keyword', 'source-refetch'));

-- keyword：关键词采集时的搜索词
ALTER TABLE crawler_runs
  ADD COLUMN IF NOT EXISTS keyword TEXT;

-- target_video_id：补源采集时的目标视频
ALTER TABLE crawler_runs
  ADD COLUMN IF NOT EXISTS target_video_id UUID
    REFERENCES videos(id) ON DELETE SET NULL;

-- ── 验证 ──────────────────────────────────────────────────────────

DO $$
DECLARE
  v_col_count INT;
  r_col_count INT;
BEGIN
  SELECT COUNT(*) INTO v_col_count
  FROM information_schema.columns
  WHERE table_name = 'videos'
    AND column_name IN ('douban_status', 'source_check_status', 'meta_score');

  SELECT COUNT(*) INTO r_col_count
  FROM information_schema.columns
  WHERE table_name = 'crawler_runs'
    AND column_name IN ('crawl_mode', 'keyword', 'target_video_id');

  IF v_col_count < 3 THEN
    RAISE EXCEPTION 'Migration 032: videos 表字段添加失败，期望 3 个，实际 %', v_col_count;
  END IF;

  IF r_col_count < 3 THEN
    RAISE EXCEPTION 'Migration 032: crawler_runs 表字段添加失败，期望 3 个，实际 %', r_col_count;
  END IF;

  RAISE NOTICE 'Migration 032 OK: videos +3 fields, crawler_runs +3 fields';
END $$;

COMMIT;
