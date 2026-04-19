-- 047_create_brands_table.sql
-- TOKEN-08: brands 表，承载 Brand 层 token 覆盖（仅 semantic + component 子集）
-- 架构约束（ADR-022）：overrides 顶层只允许 { semantic, component }，由应用层 zod 校验
-- 幂等：可重复执行

-- ──────────────────────── up ────────────────────────

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS brands (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT         NOT NULL,
  name        TEXT         NOT NULL,
  overrides   JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ  NULL
);

-- slug 在有效行内唯一；软删除后允许复用同 slug
CREATE UNIQUE INDEX IF NOT EXISTS brands_slug_active_uniq
  ON brands (slug)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS brands_active_created_at_idx
  ON brands (created_at)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION brands_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS brands_set_updated_at_trg ON brands;
CREATE TRIGGER brands_set_updated_at_trg
  BEFORE UPDATE ON brands
  FOR EACH ROW
  EXECUTE FUNCTION brands_set_updated_at();

COMMIT;

-- ──────────────────────── down ──────────────────────

-- DROP TRIGGER IF EXISTS brands_set_updated_at_trg ON brands;
-- DROP FUNCTION IF EXISTS brands_set_updated_at();
-- DROP TABLE IF EXISTS brands CASCADE;
