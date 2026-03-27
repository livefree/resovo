-- Migration 022: add site_id to videos
-- Links each video to its originating crawler site (nullable: existing rows get NULL).

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES crawler_sites(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_videos_site_id ON videos(site_id) WHERE site_id IS NOT NULL;
