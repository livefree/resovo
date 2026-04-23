-- 050_create_home_modules.sql
-- 描述：首页模块化编排表，支持 banner/featured/top10/type_shortcuts 四类 slot
-- 日期：2026-04-22
-- ADR：ADR-052
-- 幂等：是（CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS）
--
-- ⚠️  Down 路径说明（项目约定）：
--   scripts/migrate.ts 将整个文件内容作为单条 SQL 执行，不区分 up/down 节。
--   因此 down 路径必须保持注释形式，否则建表后立即被 DROP。
--   需要回滚时，手动解注释 down 节并在目标数据库独立执行（与 049 等迁移同约定）。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS home_modules (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  slot              TEXT         NOT NULL
                                   CHECK (slot IN ('banner', 'featured', 'top10', 'type_shortcuts')),
  brand_scope       TEXT         NOT NULL DEFAULT 'all-brands'
                                   CHECK (brand_scope IN ('brand-specific', 'all-brands')),
  brand_slug        TEXT         NULL,
  ordering          INT          NOT NULL DEFAULT 0,
  content_ref_type  TEXT         NOT NULL
                                   CHECK (content_ref_type IN ('video', 'external_url', 'custom_html', 'video_type')),
  content_ref_id    TEXT         NOT NULL,
  start_at          TIMESTAMPTZ  NULL,
  end_at            TIMESTAMPTZ  NULL,
  enabled           BOOLEAN      NOT NULL DEFAULT true,
  metadata          JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- brand_scope = 'brand-specific' 时必须指定 brand_slug
  CONSTRAINT home_modules_brand_slug_required
    CHECK (brand_scope != 'brand-specific' OR brand_slug IS NOT NULL),
  -- brand_scope = 'all-brands' 时 brand_slug 必须为 NULL
  CONSTRAINT home_modules_brand_slug_exclusive
    CHECK (brand_scope != 'all-brands' OR brand_slug IS NULL),
  -- content_ref_type × slot 语义约束（ADR-052）
  CONSTRAINT home_modules_ref_type_slot_compat CHECK (
    (slot = 'banner'         AND content_ref_type IN ('video', 'external_url', 'custom_html')) OR
    (slot = 'featured'       AND content_ref_type = 'video') OR
    (slot = 'top10'          AND content_ref_type = 'video') OR
    (slot = 'type_shortcuts' AND content_ref_type = 'video_type')
  ),
  -- 时间窗合法性
  CONSTRAINT home_modules_time_window_valid
    CHECK (start_at IS NULL OR end_at IS NULL OR start_at < end_at)
);

-- 主查询索引：slot × brand_scope × brand_slug × ordering（覆盖前台 listActiveHomeModules 主路径）
CREATE INDEX IF NOT EXISTS home_modules_slot_brand_idx
  ON home_modules (slot, brand_scope, brand_slug, ordering)
  WHERE enabled = true;

-- 时间窗索引：用于后台失效模块清单与 cron 扫描
CREATE INDEX IF NOT EXISTS home_modules_time_window_idx
  ON home_modules (start_at, end_at)
  WHERE enabled = true;

-- content_ref_id 反查索引（当 video 软删 / type 下线时用于级联失效）
CREATE INDEX IF NOT EXISTS home_modules_content_ref_idx
  ON home_modules (content_ref_type, content_ref_id);

CREATE OR REPLACE FUNCTION home_modules_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS home_modules_set_updated_at_trg ON home_modules;
CREATE TRIGGER home_modules_set_updated_at_trg
  BEFORE UPDATE ON home_modules
  FOR EACH ROW EXECUTE FUNCTION home_modules_set_updated_at();

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- DROP TRIGGER IF EXISTS home_modules_set_updated_at_trg ON home_modules;
-- DROP FUNCTION IF EXISTS home_modules_set_updated_at();
-- DROP INDEX IF EXISTS home_modules_content_ref_idx;
-- DROP INDEX IF EXISTS home_modules_time_window_idx;
-- DROP INDEX IF EXISTS home_modules_slot_brand_idx;
-- DROP TABLE IF EXISTS home_modules;
-- COMMIT;
