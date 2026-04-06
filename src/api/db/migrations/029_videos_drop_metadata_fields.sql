-- 029_videos_drop_metadata_fields.sql
-- CHG-361: 清理 videos 表中已迁移到 media_catalog 的字段，并将 catalog_id 设为 NOT NULL
-- 执行顺序：必须在 028_videos_add_catalog_id.sql 之后（全部 catalog_id 已回填）运行
-- 必须在 CHG-364 (videos.ts 查询层改造) 上线后才能在生产环境执行
-- 幂等：可重复执行（DROP COLUMN IF EXISTS，ALTER COLUMN 无副作用）

BEGIN;

-- ── 前置断言：catalog_id 必须全部已回填 ──────────────────────────
-- 若有 unlinked 视频则拒绝执行（避免 SET NOT NULL 失败）

DO $$
DECLARE
  unlinked_count INT;
BEGIN
  SELECT COUNT(*) INTO unlinked_count
  FROM videos
  WHERE catalog_id IS NULL
    AND deleted_at IS NULL;

  IF unlinked_count > 0 THEN
    RAISE EXCEPTION 'Migration 029 blocked: % active videos still have NULL catalog_id. Run 028 first and verify all rows are linked.', unlinked_count;
  END IF;
END $$;

-- ── Step 1: 删除引用被移除列的多列索引 ───────────────────────────
-- 单列索引会随 DROP COLUMN 自动删除；多列索引需先手动删除

DROP INDEX IF EXISTS idx_videos_normalized_year_type;
-- 包含 title_normalized（将被删除）和 year（将被删除）

-- ── Step 2: 删除已迁移到 media_catalog 的字段 ────────────────────
-- 保留字段：id, short_id, slug, title（冗余副本）, type（冗余副本）,
--           catalog_id, episode_count, season_number（在 video_sources）,
--           source_category（爬虫原始值）,
--           source_content_type, normalized_type, content_format, episode_pattern（爬虫分类）,
--           content_rating, is_published, deleted_at, created_at, updated_at,
--           review_status, visibility_status, review_reason, review_source,
--           reviewed_by, reviewed_at, needs_manual_review（治理字段）,
--           site_key（平台实例字段）

-- 已迁移到 media_catalog（共 15 列）
ALTER TABLE videos
  DROP COLUMN IF EXISTS title_en,
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS cover_url,
  DROP COLUMN IF EXISTS rating,
  DROP COLUMN IF EXISTS year,
  DROP COLUMN IF EXISTS country,
  DROP COLUMN IF EXISTS status,        -- 系列完结状态（ongoing/completed），现在在 media_catalog.status
  DROP COLUMN IF EXISTS director,
  DROP COLUMN IF EXISTS "cast",
  DROP COLUMN IF EXISTS writers,
  DROP COLUMN IF EXISTS genre,         -- 题材，现在在 media_catalog.genre（名称约束随列自动删除）
  DROP COLUMN IF EXISTS genre_source,  -- 题材来源追踪，随 genre 一同移除（孤立字段）
  DROP COLUMN IF EXISTS douban_id,     -- 现在在 media_catalog.douban_id
  DROP COLUMN IF EXISTS title_normalized, -- 现在在 media_catalog.title_normalized
  DROP COLUMN IF EXISTS metadata_source;  -- 现在在 media_catalog.metadata_source

-- ── Step 3: catalog_id 改为 NOT NULL ─────────────────────────────
-- 前置断言已确保没有 NULL 值，此步骤安全

ALTER TABLE videos
  ALTER COLUMN catalog_id SET NOT NULL;

-- ── Step 4: 删除被孤立的单列索引（因 DROP COLUMN 不自动删除，需手动清理）──
-- 说明：PostgreSQL 在 DROP COLUMN 时会自动删除引用该列的索引，
-- 但若执行顺序异常（如已手动重建），此处作为额外保护

DROP INDEX IF EXISTS idx_videos_year;
DROP INDEX IF EXISTS idx_videos_rating;
DROP INDEX IF EXISTS idx_videos_country;
DROP INDEX IF EXISTS idx_videos_title_normalized;

-- ── Step 5: 在 videos 表上新增基于 catalog_id 的过滤查询辅助索引 ─
-- idx_videos_catalog_id 已在 028 创建，此处无需重复

-- ── 验证 ──────────────────────────────────────────────────────────

DO $$
DECLARE
  col_exists BOOLEAN;
  null_catalog INT;
BEGIN
  -- 确认 genre 列已删除
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'genre'
  ) INTO col_exists;

  IF col_exists THEN
    RAISE WARNING 'Migration 029: videos.genre column still exists (DROP may have failed)';
  ELSE
    RAISE NOTICE 'Migration 029: videos.genre column removed ✓';
  END IF;

  -- 确认 catalog_id NOT NULL
  SELECT COUNT(*) INTO null_catalog FROM videos WHERE catalog_id IS NULL;
  IF null_catalog > 0 THEN
    RAISE WARNING 'Migration 029: % rows still have NULL catalog_id', null_catalog;
  ELSE
    RAISE NOTICE 'Migration 029: catalog_id is fully linked ✓';
  END IF;

  RAISE NOTICE 'Migration 029 complete: 15 metadata columns removed from videos, catalog_id set NOT NULL';
END $$;

COMMIT;
