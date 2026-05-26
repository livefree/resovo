-- Migration 076: ADR-155 D-155-6 / EP-1C-1a — 多 dailyTime 支持的防重维度升级
--
-- 背景：当前 daily 模式防重维度是 `auto_crawl_last_trigger_date`（天级 string），
-- 多 dailyTime 时同一天的 03:00 + 04:00 触发后会互相阻塞（第二个时间命中"已触发"防重）。
-- 升级为 `auto_crawl_last_trigger_marks JSONB`：value = `{ "YYYY-MM-DD HH:MM": "isoTs", ... }`，
-- 允许同日不同时间各触发一次，相同 dailyTime 同日防重保持。
--
-- 关键约束：
--   - 旧 `auto_crawl_last_trigger_date` 保留向后兼容（不删；EP-1C-1b 后 scheduler 不再读）
--   - 新 marks 字段是 JSON object 字符串（system_settings.value 是 text），由 scheduler 反序列化
--   - 7 天前 keys 由 scheduler tick GC（Y-155-2 / 避免无界增长）
--
-- 关联 ADR：ADR-155 D-155-6（🟢 Accepted）、ADR-154 D-154-3 防重 anchor 范式延伸

INSERT INTO system_settings (key, value, updated_at)
VALUES ('auto_crawl_last_trigger_marks', '{}', NOW())
ON CONFLICT (key) DO NOTHING;

-- ROLLBACK:
-- DELETE FROM system_settings WHERE key = 'auto_crawl_last_trigger_marks';
