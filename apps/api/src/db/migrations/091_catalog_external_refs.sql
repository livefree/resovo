-- 091_catalog_external_refs.sql
-- 描述：catalog 级 canonical 外部身份映射真源（SEQ-20260602-03 / CHG-VIR-12-B / Phase 5b）
--   schema 真源 = ADR-177 D-177-1（DDL 草案照落）+ D-177-3（约束分级 partial unique）。
--   media_catalog 四外部 ID 列自此降级为读优化 cache（D-177-5 语义定档；本 migration 零数据
--   变更，既有数据迁移 = CHG-VIR-12-C，写路径/守卫 = 12-D，findOrCreate 旁路对照 = 12-E）。
--   R10（external_kind 一致 + exact↔parent 互斥）为跨行不变量，应用层守卫随 12-D 实装。
-- 日期：2026-06-03
-- 幂等：是（IF NOT EXISTS）
-- ADR: ADR-177 D-177-1/D-177-3 + R2/R9 + AMENDMENT D-177-11~14（映射细则/迁移/写路径节奏）
--
-- 索引设计 4 步核验（db-rules.md）：
--   1. 索引键：① uq_catalog_external_refs_exact（exact 全局唯一）② uq_catalog_external_refs_
--      catalog_relation（同 catalog 不重复挂同关系）③ idx_catalog_external_refs_catalog
--      ④ idx_catalog_external_refs_provider_ext
--   2. 部分索引 WHERE：① WHERE relation='exact'（精确实体↔catalog 一对一）；② WHERE relation
--      IN ('exact','parent')（candidate/rejected 不进任一 unique = 结构性保留审计历史 R2，
--      无需 decision_id）
--   3. driving 谓词：① findOrCreate 改读按 (provider, external_id) 命中 exact（12-E 对照/
--      未来切主读）→ 索引④；② 上卷 job 写入幂等 ON CONFLICT → 索引①②；③ catalog 删行
--      合并重指向按 catalog_id 反查全部 ref → 索引③；④ RR-A exact 预检按 (provider,
--      external_id, external_kind) → 索引①
--   4. 匹配判定：4 索引完整覆盖；season_number 哨兵 COALESCE 0 与 ADR-176 统一（R9）

BEGIN;

CREATE TABLE IF NOT EXISTS catalog_external_refs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id      UUID NOT NULL REFERENCES media_catalog(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL CHECK (provider IN ('imdb','tmdb','douban','bangumi')),
  external_id     TEXT NOT NULL,                 -- provider 侧 ID（统一 TEXT，tmdb 数值亦存文本）
  external_kind   TEXT NOT NULL CHECK (external_kind IN ('show','season','movie','subject')),
  relation        TEXT NOT NULL DEFAULT 'candidate'
                  CHECK (relation IN ('exact','parent','candidate','rejected')),
  season_number   INT  NULL CHECK (season_number IS NULL OR season_number > 0),
  confidence      NUMERIC(4,2),
  source          TEXT NOT NULL CHECK (source IN ('auto','manual')),
  is_primary      BOOLEAN NOT NULL DEFAULT false,
  linked_by       TEXT,                          -- auto / moderator / admin / rollup-job
  rollup_rule     TEXT,                          -- 上卷派生溯源（D-177-4 命中规则；YY-B）
  linked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes           TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ① exact 全局唯一（D-177-3 索引①）：一个精确外部实体只能精确对应一个 catalog
CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_external_refs_exact
  ON catalog_external_refs (provider, external_id, external_kind)
  WHERE relation = 'exact';

-- ② 同一 catalog 不重复挂同一外部关系（exact/parent 均受约束；candidate/rejected 不进
--   任一 partial unique = 天然保留多条候选/拒绝历史 R2）。
--   season_number 哨兵 COALESCE 0 与 ADR-176 口径统一（R9，依赖上方 CHECK>0，禁放宽）
CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_external_refs_catalog_relation
  ON catalog_external_refs (
    catalog_id, provider, external_id, external_kind, relation,
    (COALESCE(season_number, 0))
  )
  WHERE relation IN ('exact', 'parent');

-- ③ catalog_id 反查（上卷 job 输入 / 合并重指向 / cache 一致性校验）
CREATE INDEX IF NOT EXISTS idx_catalog_external_refs_catalog
  ON catalog_external_refs (catalog_id);

-- ④ provider+external_id 命中（findOrCreate 改读 / 对照旁路 / RR-A 预检）
CREATE INDEX IF NOT EXISTS idx_catalog_external_refs_provider_ext
  ON catalog_external_refs (provider, external_id);

COMMIT;

-- 验证（参 migration 086/089 DO 范式）
DO $$
DECLARE idx_count INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'catalog_external_refs') THEN
    RAISE EXCEPTION 'Migration 091 failed: catalog_external_refs table not created';
  END IF;
  SELECT COUNT(*) INTO idx_count FROM pg_indexes
   WHERE tablename = 'catalog_external_refs'
     AND indexname IN ('uq_catalog_external_refs_exact',
                       'uq_catalog_external_refs_catalog_relation',
                       'idx_catalog_external_refs_catalog',
                       'idx_catalog_external_refs_provider_ext');
  IF idx_count < 4 THEN
    RAISE EXCEPTION 'Migration 091 failed: 索引缺失，期望 4 实际 %', idx_count;
  END IF;
  RAISE NOTICE 'Migration 091 OK: catalog_external_refs + 2 partial unique + 2 索引已落地';
END $$;
