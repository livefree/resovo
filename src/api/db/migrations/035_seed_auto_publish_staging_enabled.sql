-- Migration 035: seed default value for auto_publish_staging_enabled
--
-- CHG-393: Phase 1 never initialized this key in system_settings.
-- The scheduler now defaults to enabled when the key is missing (null),
-- but this migration seeds the explicit value so it's visible in any
-- future admin UI and avoids reliance on the null-as-default fallback.
--
-- Does NOT overwrite an existing value (ON CONFLICT DO NOTHING).

BEGIN;

INSERT INTO system_settings (key, value, updated_at)
VALUES ('auto_publish_staging_enabled', 'true', NOW())
ON CONFLICT (key) DO NOTHING;

-- Verify row exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM system_settings WHERE key = 'auto_publish_staging_enabled'
  ) THEN
    RAISE EXCEPTION 'Migration 035: auto_publish_staging_enabled row not found after insert';
  END IF;
END $$;

COMMIT;
