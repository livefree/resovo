-- Migration 018-partial: crawler_sites.ingest_policy
-- CHG-174: 站点级采集策略，优先级高于全局 AUTO_PUBLISH_CRAWLED 环境变量

BEGIN;

ALTER TABLE crawler_sites
  ADD COLUMN IF NOT EXISTS ingest_policy JSONB NOT NULL DEFAULT '{
    "allow_auto_publish": false,
    "allow_search_index": true,
    "allow_recommendation": true,
    "allow_public_detail": true,
    "allow_playback": true,
    "require_review_before_publish": true
  }';

COMMIT;
