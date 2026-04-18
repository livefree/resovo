-- 046_video_sources_source_site_key.sql
-- CHG-414: 为 video_sources 新增行级源站标识 source_site_key
-- 背景：CHG-413 通过 videos.site_key（视频级）推导 display_name，
--       当一个视频聚合来自多个源站的线路时，所有线路会显示同一名称，与实际不符。
--       本迁移在 video_sources 行级写入爬虫入库时的 source_site_key，
--       JOIN 路径改为优先用行级 source_site_key，NULL 时 fallback 到 videos.site_key。
-- 幂等：可重复执行

BEGIN;

ALTER TABLE video_sources
  ADD COLUMN IF NOT EXISTS source_site_key VARCHAR(100) NULL;

-- 存量数据 backfill：从 videos.site_key 回填（NULL 视频或无 site_key 的行保持 NULL）
UPDATE video_sources vs
SET    source_site_key = v.site_key
FROM   videos v
WHERE  v.id = vs.video_id
  AND  vs.source_site_key IS NULL
  AND  v.site_key IS NOT NULL;

DO $$
DECLARE
  col_count INT;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'video_sources'
    AND column_name = 'source_site_key';

  IF col_count < 1 THEN
    RAISE EXCEPTION 'Migration 046: video_sources.source_site_key 列不存在';
  END IF;

  RAISE NOTICE 'Migration 046 OK: video_sources.source_site_key 已添加并 backfill';
END $$;

COMMIT;
