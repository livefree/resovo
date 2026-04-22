-- 049_create_home_banners.sql
-- 描述：首页 Banner 表，支持多品牌 / 多语言 / 时间窗管理
-- 日期：2026-04-21
-- ADR：ADR-046 §M5-API-BANNER-01
-- 幂等：是（CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS）
--
-- ⚠️  Down 路径说明（项目约定）：
--   scripts/migrate.ts 将整个文件内容作为单条 SQL 执行，不区分 up/down 节。
--   因此 down 路径必须保持注释形式，否则建表后立即被 DROP。
--   需要回滚时，手动解注释 down 节并在目标数据库独立执行（与 047/048 等迁移同约定）。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS home_banners (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  image_url    TEXT         NOT NULL,
  link_type    TEXT         NOT NULL DEFAULT 'external'
                              CHECK (link_type IN ('video', 'external')),
  link_target  TEXT         NOT NULL DEFAULT '',
  sort_order   INT          NOT NULL DEFAULT 0,
  active_from  TIMESTAMPTZ  NULL,
  active_to    TIMESTAMPTZ  NULL,
  is_active    BOOLEAN      NOT NULL DEFAULT true,
  brand_scope  TEXT         NOT NULL DEFAULT 'all-brands'
                              CHECK (brand_scope IN ('brand-specific', 'all-brands')),
  brand_slug   TEXT         NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- brand_scope = 'brand-specific' 时必须指定 brand_slug
  CONSTRAINT home_banners_brand_slug_required
    CHECK (brand_scope != 'brand-specific' OR brand_slug IS NOT NULL),
  -- brand_scope = 'all-brands' 时 brand_slug 必须为 NULL
  CONSTRAINT home_banners_brand_slug_exclusive
    CHECK (brand_scope != 'all-brands' OR brand_slug IS NULL)
);

-- 主查询索引：活跃状态 + 时间窗 + 排序
CREATE INDEX IF NOT EXISTS home_banners_active_window_idx
  ON home_banners (is_active, active_from, active_to, sort_order);

-- 品牌过滤索引
CREATE INDEX IF NOT EXISTS home_banners_brand_scope_idx
  ON home_banners (brand_scope, brand_slug)
  WHERE is_active = true;

CREATE OR REPLACE FUNCTION home_banners_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS home_banners_set_updated_at_trg ON home_banners;
CREATE TRIGGER home_banners_set_updated_at_trg
  BEFORE UPDATE ON home_banners
  FOR EACH ROW EXECUTE FUNCTION home_banners_set_updated_at();

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- DROP TRIGGER IF EXISTS home_banners_set_updated_at_trg ON home_banners;
-- DROP FUNCTION IF EXISTS home_banners_set_updated_at();
-- DROP INDEX IF EXISTS home_banners_brand_scope_idx;
-- DROP INDEX IF EXISTS home_banners_active_window_idx;
-- DROP TABLE IF EXISTS home_banners;
-- COMMIT;
