-- 028_videos_add_catalog_id.sql
-- CHG-360: 为现有 videos 创建对应的 media_catalog 条目，并添加 catalog_id 外键
-- 执行顺序：必须在 026_create_media_catalog.sql 之后运行
-- 幂等：可重复执行（CTE 使用 ON CONFLICT DO NOTHING）

BEGIN;

-- ── Step 1: videos 表添加 catalog_id 列（nullable，后续 029 再设为 NOT NULL）────

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS catalog_id UUID REFERENCES media_catalog(id) ON DELETE SET NULL;

-- ── Step 2: 为现有 videos 批量创建 media_catalog 条目 ────────────────────────
-- 只处理 catalog_id 还为空的行（幂等支持）
-- 注意：title_normalized 在 videos 表中已存在（由 migration 007 生成）

WITH video_data AS (
  SELECT
    v.id            AS video_id,
    v.title,
    v.title_en,
    v.description,
    v.cover_url,
    v.type,
    v.year,
    v.country,
    v.rating,
    v.director,
    v.cast,
    v.writers,
    v.status,
    v.genre,
    v.douban_id,
    COALESCE(v.title_normalized, lower(v.title)) AS title_normalized,
    COALESCE(v.metadata_source, 'crawler')        AS metadata_source
  FROM videos v
  WHERE v.catalog_id IS NULL
    AND v.deleted_at IS NULL
),
inserted_catalog AS (
  INSERT INTO media_catalog (
    title,
    title_en,
    title_normalized,
    type,
    year,
    country,
    description,
    cover_url,
    rating,
    director,
    cast,
    writers,
    status,
    genre,
    douban_id,
    metadata_source
  )
  SELECT
    vd.title,
    vd.title_en,
    vd.title_normalized,
    -- videos.type 枚举与 media_catalog.type 枚举存在差异（media_catalog 更多类型）
    -- videos 中 'short', 'documentary' 等已在 migration 013 引入，保持原样
    vd.type,
    vd.year,
    vd.country,
    vd.description,
    vd.cover_url,
    vd.rating,
    vd.director,
    vd.cast,
    vd.writers,
    vd.status,
    vd.genre,
    vd.douban_id,
    vd.metadata_source::TEXT
  FROM video_data vd
  -- 若同一 title_normalized+year+type 已存在（且无精确 ID）则不重复创建
  ON CONFLICT DO NOTHING
  RETURNING id, title, title_normalized, type, year, douban_id
),
-- 对于 ON CONFLICT 跳过的行（catalog 已存在），通过 douban_id 或 title_normalized+year+type 找到已有 catalog
existing_catalog AS (
  SELECT mc.id AS catalog_id, v.id AS video_id
  FROM videos v
  JOIN media_catalog mc ON (
    -- 优先通过 douban_id 匹配
    (v.douban_id IS NOT NULL AND mc.douban_id = v.douban_id)
    OR
    -- 回退到 title_normalized + year + type 匹配
    (v.douban_id IS NULL
      AND mc.title_normalized = COALESCE(v.title_normalized, lower(v.title))
      AND mc.year IS NOT DISTINCT FROM v.year
      AND mc.type = v.type)
  )
  WHERE v.catalog_id IS NULL
    AND v.deleted_at IS NULL
)
-- Step 2a: 用新插入的 catalog 条目回填 catalog_id
UPDATE videos v
SET catalog_id = ic.id,
    updated_at = NOW()
FROM inserted_catalog ic
JOIN video_data vd ON vd.title = ic.title
  AND vd.title_normalized = ic.title_normalized
  AND vd.type = ic.type
  AND vd.year IS NOT DISTINCT FROM ic.year
WHERE v.id = vd.video_id
  AND v.catalog_id IS NULL;

-- Step 2b: 用已有 catalog 条目回填 catalog_id（ON CONFLICT 跳过的行）
UPDATE videos v
SET catalog_id = ec.catalog_id,
    updated_at = NOW()
FROM existing_catalog ec
WHERE v.id = ec.video_id
  AND v.catalog_id IS NULL;

-- ── Step 3: 将 videos.douban_id 迁移到 media_catalog.douban_id ──────────────
-- 针对有 douban_id 但 catalog 上还没有 douban_id 的情况

UPDATE media_catalog mc
SET douban_id  = v.douban_id,
    updated_at = NOW()
FROM videos v
WHERE v.catalog_id = mc.id
  AND v.douban_id IS NOT NULL
  AND mc.douban_id IS NULL;

-- ── Step 4: 建索引 ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_videos_catalog_id
  ON videos (catalog_id)
  WHERE catalog_id IS NOT NULL;

-- ── 验证（非阻断，仅输出统计）────────────────────────────────────────────────

DO $$
DECLARE
  total_videos    INT;
  linked_videos   INT;
  unlinked_videos INT;
BEGIN
  SELECT COUNT(*)                                    INTO total_videos    FROM videos WHERE deleted_at IS NULL;
  SELECT COUNT(*) FILTER (WHERE catalog_id IS NOT NULL) INTO linked_videos FROM videos WHERE deleted_at IS NULL;
  unlinked_videos := total_videos - linked_videos;

  RAISE NOTICE 'Migration 028 complete: total=%, linked=%, unlinked=%',
    total_videos, linked_videos, unlinked_videos;

  IF unlinked_videos > 0 THEN
    RAISE WARNING '% videos still have no catalog_id — check for title/type conflicts', unlinked_videos;
  END IF;
END $$;

COMMIT;
