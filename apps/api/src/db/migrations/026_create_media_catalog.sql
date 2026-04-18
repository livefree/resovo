-- 026_create_media_catalog.sql
-- CHG-358: 创建 media_catalog（作品元数据层）和 media_catalog_aliases 表
-- 这是三层架构改造的第一步：将纯影视元数据从 videos 表分离到独立的 media_catalog 表
-- 幂等：可重复执行，已存在时跳过

BEGIN;

-- ── media_catalog 表 ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS media_catalog (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 标题组
  title                TEXT        NOT NULL,
  -- 简体中文标准名（来源优先级：Douban NAME > Bangumi name_cn > 爬虫标题）
  title_en             TEXT,
  -- 英文名（来源：TMDB title 或爬虫 title_en）
  title_original       TEXT,
  -- 原始语言标题（日文动漫名、韩语片名等）
  title_normalized     TEXT        NOT NULL,
  -- 由 TitleNormalizer 生成，用于去重匹配

  -- 分类（与 videos.type 枚举保持一致，含未来扩展类型）
  type                 TEXT        NOT NULL
                       CHECK (type IN (
                         'movie', 'series', 'anime', 'variety',
                         'documentary', 'short', 'sports', 'music',
                         'news', 'kids', 'other'
                       )),

  -- 题材
  genre                TEXT
                       CHECK (genre IS NULL OR genre IN (
                         'action', 'comedy', 'romance', 'thriller', 'horror',
                         'sci_fi', 'fantasy', 'history', 'crime', 'mystery',
                         'war', 'family', 'biography', 'martial_arts', 'other'
                       )),
  genres_raw           TEXT[]      NOT NULL DEFAULT '{}',
  -- 来源原始多值题材（未归一化，用于调试和未来重新映射）

  -- 核心元数据
  year                 INT,
  release_date         DATE,
  country              TEXT,
  runtime_minutes      INT,
  status               TEXT        NOT NULL DEFAULT 'completed'
                       CHECK (status IN ('ongoing', 'completed')),

  -- 内容
  description          TEXT,
  cover_url            TEXT,
  rating               FLOAT       CHECK (rating >= 0 AND rating <= 10),
  rating_votes         INT,
  -- 评分人数（豆瓣 DOUBAN_VOTES 或 TMDB vote_count）

  -- 人员（数组，与 videos 表一致）
  director             TEXT[]      NOT NULL DEFAULT '{}',
  "cast"               TEXT[]      NOT NULL DEFAULT '{}',
  writers              TEXT[]      NOT NULL DEFAULT '{}',

  -- 外部 ID（精确去重依据，优先级高于标题匹配）
  imdb_id              TEXT        UNIQUE,
  -- 格式：tt0000000
  tmdb_id              INT         UNIQUE,
  douban_id            TEXT        UNIQUE,
  bangumi_subject_id   INT         UNIQUE,

  -- 元数据来源（记录级，表示该 catalog 条目的主要数据来源）
  -- 优先级：manual(5) > tmdb(4) > bangumi(3) = douban(3) > crawler(1)
  metadata_source      TEXT        NOT NULL DEFAULT 'crawler'
                       CHECK (metadata_source IN ('manual', 'tmdb', 'bangumi', 'douban', 'crawler')),

  -- 字段级锁（存字段名数组，这些字段不允许低优先级来源自动覆盖）
  -- 例：{'title', 'cover_url', 'rating'}
  -- manual 来源写入后自动将写入字段加入此数组
  locked_fields        TEXT[]      NOT NULL DEFAULT '{}',

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 索引 ─────────────────────────────────────────────────────────

-- 无精确外部 ID 时的去重索引（title_normalized + year + type 三元组唯一）
CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_title_year_type
  ON media_catalog (title_normalized, year, type)
  WHERE imdb_id IS NULL
    AND tmdb_id IS NULL
    AND bangumi_subject_id IS NULL
    AND douban_id IS NULL;

-- 外部 ID 快速查找
CREATE INDEX IF NOT EXISTS idx_catalog_imdb_id
  ON media_catalog (imdb_id)
  WHERE imdb_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_catalog_tmdb_id
  ON media_catalog (tmdb_id)
  WHERE tmdb_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_catalog_douban_id
  ON media_catalog (douban_id)
  WHERE douban_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_catalog_bangumi_id
  ON media_catalog (bangumi_subject_id)
  WHERE bangumi_subject_id IS NOT NULL;

-- 标题标准化查找（爬虫归并匹配）
CREATE INDEX IF NOT EXISTS idx_catalog_title_normalized
  ON media_catalog (title_normalized);

-- 类型+年份组合过滤（管理后台常用）
CREATE INDEX IF NOT EXISTS idx_catalog_type_year
  ON media_catalog (type, year)
  WHERE year IS NOT NULL;

-- ── updated_at 自动更新触发器 ────────────────────────────────────

CREATE OR REPLACE FUNCTION update_media_catalog_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_media_catalog_updated_at ON media_catalog;

CREATE TRIGGER trg_media_catalog_updated_at
BEFORE UPDATE ON media_catalog
FOR EACH ROW
EXECUTE FUNCTION update_media_catalog_updated_at();

-- ── media_catalog_aliases 表 ─────────────────────────────────────

-- 存储作品的多语言别名、译名变体
-- 与 video_aliases 的区别：
--   media_catalog_aliases = 作品层别名（来自 Douban ALIAS、Bangumi 别名等）
--   video_aliases         = 平台采集层别名（爬虫观测到的标题变体，用于爬虫归并）

CREATE TABLE IF NOT EXISTS media_catalog_aliases (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id  UUID        NOT NULL REFERENCES media_catalog(id) ON DELETE CASCADE,
  alias       TEXT        NOT NULL,
  lang        TEXT,
  -- BCP47 语言标签，如 'zh-Hans'、'zh-Hant'、'ja'、'en'；NULL 表示未知
  source      TEXT,
  -- 来源标记：'douban' | 'bangumi' | 'tmdb' | 'crawler' | 'manual'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (catalog_id, alias)
);

CREATE INDEX IF NOT EXISTS idx_catalog_aliases_catalog_id
  ON media_catalog_aliases (catalog_id);

-- 按别名反查 catalog（匹配时使用）
CREATE INDEX IF NOT EXISTS idx_catalog_aliases_alias
  ON media_catalog_aliases (alias);

COMMIT;
