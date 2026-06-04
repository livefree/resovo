-- 089_catalog_multilingual.sql
-- 描述：多语种标题模型落地（SEQ-20260602-03 / CHG-VIR-11-C / Phase 4c）
--   ① media_catalog.original_language（D-175-1：标注 title_original 语种，BCP47 subtag，NULL=未知）
--   ② media_catalog_aliases 结构化升级 5 列（D-175-2：region/script/kind/confidence/is_primary_for_locale）
--   ③ partial unique：每 (catalog_id, lang, region, script) locale 至多一个首选展示别名（D-175-3 fallback 前提）
--   全部 nullable 或带默认，不破坏存量行（R7）；简繁靠 script 维度区分不归一（R1）。
-- 日期：2026-06-03
-- 幂等：是（IF NOT EXISTS / ADD COLUMN IF NOT EXISTS）
-- ADR: ADR-175（Accepted / DDL 草案 D-175-1 + D-175-2 照落）
--
-- 索引设计 4 步核验（db-rules.md §"索引设计 4 步核验"）：
--   1. 索引键：(catalog_id, lang, COALESCE(region,''), COALESCE(script,'')) WHERE is_primary_for_locale
--      —— D-175-2 partial unique 草案逐字照落；既有 UNIQUE(catalog_id, alias) 保留（黄线-1 取舍）。
--   2. 部分索引 WHERE：is_primary_for_locale（绝大多数行 false，索引极小）
--   3. 候选 driving 谓词：display_title fallback 按 (catalog_id, lang[, region, script]) 查 primary alias
--   4. 匹配判定：partial unique 同时承担约束与 fallback 查询索引；非 primary 查询走既有
--      UNIQUE(catalog_id, alias) 前缀 catalog_id，无需额外索引。

BEGIN;

-- D-175-1：原语种标注（NULL=未知；回填 = scripts/catalog-multilingual-cleanup.ts）
ALTER TABLE media_catalog
  ADD COLUMN IF NOT EXISTS original_language TEXT;

-- D-175-2：media_catalog_aliases 结构化升级（全 nullable / 默认 false，存量行零破坏 R7）
ALTER TABLE media_catalog_aliases
  ADD COLUMN IF NOT EXISTS region                TEXT,
  ADD COLUMN IF NOT EXISTS script                TEXT,
  ADD COLUMN IF NOT EXISTS kind                  TEXT,
  ADD COLUMN IF NOT EXISTS confidence            NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS is_primary_for_locale BOOLEAN NOT NULL DEFAULT false;

-- D-175-2：每 locale 至多一个首选展示别名（D-175-3 确定性 fallback 前提）
CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_aliases_primary_locale
  ON media_catalog_aliases (catalog_id, lang, COALESCE(region,''), COALESCE(script,''))
  WHERE is_primary_for_locale;

COMMIT;

-- 验证：列与索引存在
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'media_catalog' AND column_name = 'original_language'
  ) THEN
    RAISE EXCEPTION 'Migration 089 failed: media_catalog.original_language not created';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'media_catalog_aliases' AND column_name = 'is_primary_for_locale'
  ) THEN
    RAISE EXCEPTION 'Migration 089 failed: media_catalog_aliases structured columns not created';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_catalog_aliases_primary_locale'
  ) THEN
    RAISE EXCEPTION 'Migration 089 failed: uq_catalog_aliases_primary_locale index not created';
  END IF;
END $$;
