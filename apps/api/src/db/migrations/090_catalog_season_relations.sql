-- 090_catalog_season_relations.sql
-- 描述：catalog 按季粒度 schema 落地（SEQ-20260602-03 / CHG-VIR-12-B / Phase 5b）
--   ① media_catalog.season_number 列 + CHECK>0（D-176-2；NULL=非分季/单季/电影/特别篇）
--   ② 唯一键改造 uq_catalog_title_year_type → uq_catalog_title_year_type_season
--      （COALESCE(season_number,0) 哨兵；存量全 NULL → 槽位 0 = 与旧键逐值等价 R2；
--       哨兵 0 正确性依赖 CHECK>0，禁放宽为 >=0 —— ADR-176 Y-A）
--   ③ catalog_relations 表（D-176-3 关系真源；5 relation 有向图）
--      + same_work_candidate 有序对 DB CHECK（R7 对称关系规范化 LEAST/GREATEST 的结构性兜底，
--        防 (A,B)/(B,A) 双行绕过 UNIQUE —— 对齐 migration 086 ck_identity_candidate_ordered 范式）
--      反对称四 relation 单向 + season_of/edition_of DAG 为跨行不变量，DB CHECK 无法表达，
--      应用层守卫随首个写入卡（CHG-VIR-12-F）实装（ADR-176 D-176-3 / AMENDMENT 拆卡定档）。
-- 日期：2026-06-03
-- 幂等：是（IF NOT EXISTS / DROP IF EXISTS）
-- ADR: ADR-176 D-176-2/D-176-3（DDL 草案照落）+ AMENDMENT D-176-7~9（写入口径与回填策略）
--
-- 索引设计 4 步核验（db-rules.md）：
--   1. 索引键：uq_catalog_title_year_type_season（唯一键改造）/ catalog_relations 内联
--      UNIQUE(from,to,relation) + idx_catalog_relations_to（反查）
--   2. 部分索引 WHERE：唯一键沿用 026 四外部 ID 全 NULL 域（语义零变更，仅扩季维度槽位）
--   3. driving 谓词：① findOrCreate Step 5 / insertCatalog ON CONFLICT（唯一键）；
--      ② 连通分量派生 from→to 正向走边（UNIQUE 复合索引前缀覆盖 from）；
--      ③ to_catalog_id 反向走边 + 合并重指向端点反查（idx_catalog_relations_to）
--   4. 匹配判定：3 索引完整覆盖各 driving 谓词；relations 表当前零写入方（写路径 12-F），
--      不加投机索引

BEGIN;

-- ① season_number 列（D-176-2）：NULL=非分季作品/单季/电影/特别篇（SP/OVA/剧场版不用
--   season_number 表达 —— Y-176-1 用独立 catalog + edition_of 关联）
ALTER TABLE media_catalog
  ADD COLUMN IF NOT EXISTS season_number INT NULL;

-- CHECK>0（哨兵不变量 Y-A：唯一键 COALESCE 哨兵 0 的正确性依赖本约束，禁放宽 >=0）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_media_catalog_season_number_positive'
  ) THEN
    ALTER TABLE media_catalog
      ADD CONSTRAINT ck_media_catalog_season_number_positive
      CHECK (season_number IS NULL OR season_number > 0);
  END IF;
END $$;

-- ② 唯一键改造（D-176-2 / R2 存量逐值不变）：
--   存量行 season_number 全 NULL → COALESCE 槽位 0 → 新键与旧键 (title_normalized, year, type)
--   在 WHERE 域内逐值等价（旧 unique 已保证无重复 → CREATE 不会失败；同事务内 DROP+CREATE，
--   CREATE 失败整体回滚旧索引保留）。
DROP INDEX IF EXISTS uq_catalog_title_year_type;
CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_title_year_type_season
  ON media_catalog (title_normalized, year, type, (COALESCE(season_number, 0)))
  WHERE imdb_id IS NULL
    AND tmdb_id IS NULL
    AND bangumi_subject_id IS NULL
    AND douban_id IS NULL;

-- ③ catalog_relations（D-176-3 关系单一真源 R6）
CREATE TABLE IF NOT EXISTS catalog_relations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_catalog_id UUID NOT NULL REFERENCES media_catalog(id) ON DELETE CASCADE,
  to_catalog_id   UUID NOT NULL REFERENCES media_catalog(id) ON DELETE CASCADE,
  relation        TEXT NOT NULL CHECK (relation IN
                    ('season_of','edition_of','remake_of','spinoff_of','same_work_candidate')),
  confidence      NUMERIC(4,2),
  source          TEXT NOT NULL CHECK (source IN ('auto','manual')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_catalog_relations_no_self CHECK (from_catalog_id <> to_catalog_id),
  -- R7 对称关系规范化有序对（same_work_candidate 写入须 from=LEAST/to=GREATEST）的 DB 兜底：
  -- 防应用层写反序产生 (A,B)/(B,A) 双行绕过 UNIQUE（086 ordered CHECK 同范式）
  CONSTRAINT ck_catalog_relations_swc_ordered CHECK (
    relation <> 'same_work_candidate' OR from_catalog_id::text < to_catalog_id::text
  ),
  CONSTRAINT uq_catalog_relations_from_to_rel UNIQUE (from_catalog_id, to_catalog_id, relation)
);

-- to_catalog_id 反向走边（连通分量派生反向 + D-176-4 合并删行端点重指向反查）；
-- from_catalog_id 由 UNIQUE 复合索引前缀覆盖，不另建
CREATE INDEX IF NOT EXISTS idx_catalog_relations_to
  ON catalog_relations (to_catalog_id);

COMMIT;

-- 验证（参 migration 086/089 DO 范式）
DO $$
DECLARE dup_count INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'media_catalog' AND column_name = 'season_number'
  ) THEN
    RAISE EXCEPTION 'Migration 090 failed: media_catalog.season_number not created';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_catalog_title_year_type') THEN
    RAISE EXCEPTION 'Migration 090 failed: 旧索引 uq_catalog_title_year_type 未删除';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_catalog_title_year_type_season') THEN
    RAISE EXCEPTION 'Migration 090 failed: uq_catalog_title_year_type_season not created';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'catalog_relations') THEN
    RAISE EXCEPTION 'Migration 090 failed: catalog_relations table not created';
  END IF;
  -- R2 逐值不变核验：WHERE 域内三元组（哨兵槽位 0）无重复 = 新唯一键与旧键等价成立
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT title_normalized, year, type, COALESCE(season_number, 0)
    FROM media_catalog
    WHERE imdb_id IS NULL AND tmdb_id IS NULL
      AND bangumi_subject_id IS NULL AND douban_id IS NULL
    GROUP BY 1, 2, 3, 4
    HAVING COUNT(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Migration 090 failed: 唯一键域内发现 % 组重复（R2 逐值不变被破坏）', dup_count;
  END IF;
  RAISE NOTICE 'Migration 090 OK: season_number + 唯一键改造 + catalog_relations 已落地';
END $$;
