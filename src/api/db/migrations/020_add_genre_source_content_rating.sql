-- 020_add_genre_source_content_rating.sql
-- CHG-182: 新增 genre_source（追踪 genre 来源）和 content_rating（内容分级）两列
-- 幂等：可重复执行，已存在时跳过

BEGIN;

-- 1. 新增 genre_source 列
--    auto   = 系统从 source_category 自动推断
--    manual = 管理员在后台手动核验
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'genre_source'
  ) THEN
    ALTER TABLE videos ADD COLUMN genre_source TEXT
      CHECK (genre_source IN ('auto', 'manual') OR genre_source IS NULL);
  END IF;
END$$;

-- 2. 新增 content_rating 列
--    general = 常规内容（默认）
--    adult   = 成人内容（当前 visibility_status='hidden'；未来开辟专区时可切换为 'public'）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'content_rating'
  ) THEN
    ALTER TABLE videos ADD COLUMN content_rating TEXT NOT NULL DEFAULT 'general'
      CHECK (content_rating IN ('general', 'adult'));
  END IF;
END$$;

-- 3. 为 content_rating 建立索引（前台查询默认过滤成人内容，高频条件）
CREATE INDEX IF NOT EXISTS idx_videos_content_rating
  ON videos (content_rating)
  WHERE deleted_at IS NULL;

COMMIT;
