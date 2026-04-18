-- 030_video_aliases_to_catalog.sql
-- CHG-362: 将 video_aliases 数据迁移到 media_catalog_aliases
-- 背景：video_aliases 存储的是爬虫归并时发现的标题变体；
--       三层架构中，别名属于作品层（media_catalog），通过 videos.catalog_id 关联迁移。
-- 执行顺序：必须在 028（videos.catalog_id 已回填）和 026（media_catalog_aliases 已创建）之后运行
-- 幂等：可重复执行（ON CONFLICT DO NOTHING，基于 catalog_id + alias 唯一约束）

BEGIN;

-- ── Step 1: 将 video_aliases 迁移到 media_catalog_aliases ────────
-- 通过 videos.catalog_id 关联，source 统一标记为 'crawler'
-- 跳过 catalog_id 为 NULL 的视频（029 之前可能存在，但 029 已设 NOT NULL）

INSERT INTO media_catalog_aliases (catalog_id, alias, lang, source)
SELECT DISTINCT
  v.catalog_id,
  va.alias,
  NULL          AS lang,      -- 爬虫别名无语言标注
  'crawler'     AS source
FROM video_aliases va
JOIN videos v ON v.id = va.video_id
WHERE v.catalog_id IS NOT NULL
  AND v.deleted_at IS NULL
ON CONFLICT (catalog_id, alias) DO NOTHING;

-- ── 验证 ──────────────────────────────────────────────────────────

DO $$
DECLARE
  total_aliases     INT;
  migrated_aliases  INT;
  skipped_no_catalog INT;
BEGIN
  SELECT COUNT(*) INTO total_aliases    FROM video_aliases;
  SELECT COUNT(*) INTO migrated_aliases FROM media_catalog_aliases WHERE source = 'crawler';
  SELECT COUNT(*) INTO skipped_no_catalog
    FROM video_aliases va
    JOIN videos v ON v.id = va.video_id
    WHERE v.catalog_id IS NULL OR v.deleted_at IS NOT NULL;

  RAISE NOTICE 'Migration 030 complete: video_aliases total=%, migrated to catalog_aliases=%, skipped(no catalog or deleted)=%',
    total_aliases, migrated_aliases, skipped_no_catalog;
END $$;

COMMIT;
