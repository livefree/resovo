-- 006_crawler_sites_status.sql
-- CHG-36: 为 crawler_sites 表添加采集状态追踪字段

ALTER TABLE crawler_sites
  ADD COLUMN IF NOT EXISTS last_crawled_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_crawl_status VARCHAR(20)
    CHECK (last_crawl_status IN ('ok', 'failed', 'running'));
