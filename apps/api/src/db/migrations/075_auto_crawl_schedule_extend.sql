-- Migration 075: Fix-D5 interval 模式触发时刻锚点（ADR-154 D-154-3）
-- auto_crawl_last_trigger_at：value = ISO8601 UTC 字符串（空串 = 从未触发）
-- 旧 auto_crawl_last_trigger_date 保留（daily 模式继续使用，不删）
-- system_settings 是 KV 表（value text），无 DDL 列类型变更
-- 本迁移仅 seed 新键占位，ticker 首次触发后 upsert 写入真实值

INSERT INTO system_settings (key, value, updated_at)
VALUES ('auto_crawl_last_trigger_at', '', NOW())
ON CONFLICT (key) DO NOTHING;

-- ROLLBACK:
-- DELETE FROM system_settings WHERE key = 'auto_crawl_last_trigger_at';
