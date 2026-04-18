-- Migration 022: add site_key to videos
-- Links videos to crawler_sites via key (VARCHAR 100), the actual PK of crawler_sites.
-- Replaces the broken site_id UUID approach (CHG-239, reverted) which assumed a non-existent id column.

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS site_key VARCHAR(100)
    REFERENCES crawler_sites(key) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_videos_site_key
  ON videos(site_key)
  WHERE site_key IS NOT NULL;
