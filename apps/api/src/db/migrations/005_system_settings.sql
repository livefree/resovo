-- 005_system_settings.sql
-- CHG-33: 站点配置键值表 + 爬虫源站配置表

-- ── 站点通用配置（键值对存储） ─────────────────────────────────

CREATE TABLE IF NOT EXISTS system_settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT         NOT NULL,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── 爬虫源站配置 ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crawler_sites (
  key          VARCHAR(100) PRIMARY KEY,
  name         VARCHAR(200) NOT NULL,
  api_url      TEXT         NOT NULL,
  detail       TEXT,
  source_type  VARCHAR(20)  NOT NULL DEFAULT 'vod'
                            CHECK (source_type IN ('vod', 'shortdrama')),
  format       VARCHAR(10)  NOT NULL DEFAULT 'json'
                            CHECK (format IN ('json', 'xml')),
  weight       INTEGER      NOT NULL DEFAULT 50
                            CHECK (weight BETWEEN 0 AND 100),
  is_adult     BOOLEAN      NOT NULL DEFAULT false,
  disabled     BOOLEAN      NOT NULL DEFAULT false,
  from_config  BOOLEAN      NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crawler_sites_disabled ON crawler_sites (disabled);
