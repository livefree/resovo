-- Migration 038: crawler_sites 新增 display_name 字段
-- 用途：存储对用户友好的中文展示名称，区别于内部 key。
-- 调用方：src/lib/line-display-name.ts normalizeProviderName

ALTER TABLE crawler_sites ADD COLUMN IF NOT EXISTS display_name VARCHAR(200);

-- 补充已知源站中文展示名（seed data，幂等）
UPDATE crawler_sites SET display_name = '暴风资源'   WHERE key = 'bfzy'    AND display_name IS NULL;
UPDATE crawler_sites SET display_name = '1080P资源'  WHERE key = '1080zyk' AND display_name IS NULL;
UPDATE crawler_sites SET display_name = '量子资源'   WHERE key = 'lzzy'    AND display_name IS NULL;
UPDATE crawler_sites SET display_name = '金鹰资源'   WHERE key = 'jyzy'    AND display_name IS NULL;
UPDATE crawler_sites SET display_name = '卧龙资源'   WHERE key = 'wolongzy' AND display_name IS NULL;
UPDATE crawler_sites SET display_name = '速播资源'   WHERE key = 'subo'    AND display_name IS NULL;
UPDATE crawler_sites SET display_name = '魔都资源'   WHERE key = 'modu'    AND display_name IS NULL;
UPDATE crawler_sites SET display_name = '虎牙资源'   WHERE key = 'huya'    AND display_name IS NULL;
UPDATE crawler_sites SET display_name = '优质资源'   WHERE key = 'youzzy'  AND display_name IS NULL;
