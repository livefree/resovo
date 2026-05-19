-- 066_system_settings_seed_notifications_session.sql
-- ADR-126 / CHG-SN-7-REDO-03-C
--
-- 新增 8 个 settings key 的默认值 seed：
--   通知（5）：notification_email_enabled / notification_email_to /
--              notification_webhook_enabled / notification_webhook_url / notification_webhook_secret
--   登录会话（3）：session_timeout_minutes / session_max_concurrent / session_extend_on_activity
--
-- ON CONFLICT DO NOTHING：生产环境已有值时不覆盖（保留用户自定义）

INSERT INTO system_settings (key, value, updated_at) VALUES
  ('notification_email_enabled',    'false', NOW()),
  ('notification_email_to',         '',      NOW()),
  ('notification_webhook_enabled',  'false', NOW()),
  ('notification_webhook_url',      '',      NOW()),
  ('notification_webhook_secret',   '',      NOW()),
  ('session_timeout_minutes',       '60',    NOW()),
  ('session_max_concurrent',        '5',     NOW()),
  ('session_extend_on_activity',    'true',  NOW())
ON CONFLICT (key) DO NOTHING;
