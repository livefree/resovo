-- 079_source_line_aliases_codename_priority_retired.sql
-- 描述：source_line_aliases 扩 codename / priority / retired_at / auto_retired 四字段
--       ADR-164 / CHG-368-B-A1 / plan §17 route-labeling Phase 3
-- 日期：2026-05-28
-- ADR：ADR-164（D-164-1..12 全闭环 / Migration 079 SQL 草案完整对齐）+ ADR-114-NEGATED（复合 PK 跨站不合并 / 既有约束保留）
-- 任务卡：CHG-368-B-A1 / SEQ-20260527-MOD-WAVE2
-- 幂等：是（ADD COLUMN IF NOT EXISTS / ADD CONSTRAINT IF NOT EXISTS / CREATE [UNIQUE] INDEX IF NOT EXISTS / DO 块 information_schema 守卫）
--
-- 字段语义（详 ADR-164 §3）：
--   codename     VARCHAR(20)  NULL                       — 运维短码（"泰山-2"）/ 永久绑定 (siteKey, sourceName)
--   priority     SMALLINT     NOT NULL DEFAULT 0         — Layer A effective_score 5% 通道 / 0-100
--   retired_at   TIMESTAMPTZ  NULL                       — 软删时间戳（NULL=在役 / NOT NULL=退役时间）
--   auto_retired BOOLEAN      NOT NULL DEFAULT false     — true=worker 自动退役 / false=人工
--
-- 唯一约束：(codename) WHERE codename IS NOT NULL AND retired_at IS NULL
--   活跃 codename 全局唯一 / 退役后可复用 / NULL codename 不参与（D-164-9）

BEGIN;

-- ── 1. 列扩展 ─────────────────────────────────────────────────────

ALTER TABLE source_line_aliases
  ADD COLUMN IF NOT EXISTS codename     VARCHAR(20)  NULL,
  ADD COLUMN IF NOT EXISTS priority     SMALLINT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retired_at   TIMESTAMPTZ  NULL,
  ADD COLUMN IF NOT EXISTS auto_retired BOOLEAN      NOT NULL DEFAULT false;

COMMENT ON COLUMN source_line_aliases.codename
  IS '运维短码（如 "泰山-2"）/ NULL = 未分配 / 活跃部分唯一（idx_source_line_aliases_codename_active）/ 永久绑定 (siteKey, sourceName) / ADR-164 D-164-2';
COMMENT ON COLUMN source_line_aliases.priority
  IS 'Layer A effective_score priority_bonus 通道 / 0-100 SMALLINT / NOT NULL DEFAULT 0 / route-scoring.ts 归一化 priority/100 / ADR-164 D-164-3';
COMMENT ON COLUMN source_line_aliases.retired_at
  IS '退役时间戳 / NULL = 在役 / NOT NULL = 退役 + 90 天冷却后 codename 可被新别名复用 / 应用层判定冷却期 / ADR-164 D-164-4';
COMMENT ON COLUMN source_line_aliases.auto_retired
  IS 'true = worker 自动退役（全 dead 180 天 / plan §10.5）/ false = 人工 POST retire 端点 / ADR-164 D-164-8';

-- ── 2. CHECK 约束（priority 范围 / 幂等创建）─────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chk_source_line_aliases_priority_range'
      AND table_name = 'source_line_aliases'
  ) THEN
    ALTER TABLE source_line_aliases
      ADD CONSTRAINT chk_source_line_aliases_priority_range
        CHECK (priority >= 0 AND priority <= 100);
  END IF;
END $$;

-- ── 3. 唯一部分索引（在役 codename / D-164-9）─────────────────────────
-- 索引覆盖：仅"在役行"（codename IS NOT NULL AND retired_at IS NULL）的
-- codename 列唯一性约束 + 排序结构。
-- 候选查询路径：
--   ① 在役 codename 唯一性约束（PUT upsert 冲突检测 / DB 强制全局唯一）
--   ② listSources 主路径 JOIN 谓词 `retired_at IS NULL`（部分索引 WHERE
--      子句包含同条件 / 规划器可能消费）
-- 不适用：
--   ① cooling lookup（cooling 查 `retired_at IS NOT NULL` 的 codename / 部分
--      索引谓词方向相反 / 不可用）
--   ② 已退役行查询（同上反向条件）

CREATE UNIQUE INDEX IF NOT EXISTS idx_source_line_aliases_codename_active
  ON source_line_aliases (codename)
  WHERE codename IS NOT NULL AND retired_at IS NULL;

-- ── 4. 辅助索引（已退役行集合 / 候选未来路径）─────────────────────────
-- 索引覆盖：仅"已退役行"（retired_at IS NOT NULL）的 retired_at 列排序结构。
-- 候选未来查询路径（实际规划器选用取决于数据 selectivity / 实测 EXPLAIN ANALYZE）：
--   ① admin UI "已退役" tab（CHG-368-B-B）：`WHERE retired_at IS NOT NULL ORDER BY retired_at DESC`
--   ② GET codename-pool cooling 段（CHG-368-B-A2）：`WHERE retired_at >= NOW() - 90 days`
--      列出全部 cooling codename（按 retired_at 范围扫描 / 不按 codename 单值）
-- 不适用：
--   ① listSources 主路径 `retired_at IS NULL`（反向条件 / 由 idx_codename_active 覆盖）
--   ② 按 codename 查询 cooling（如 isCodenameInCooling(codename) `WHERE codename = $1
--      AND retired_at IS NOT NULL`）：**当前 schema 无适用索引**，access path =
--      全表扫描或先按 retired_at 范围扫再过滤 codename。规划器视实际数据
--      selectivity 选用。如未来 cooling lookup by codename 成为热路径，CHG-368-B-A2
--      可独立评估增设 `(codename) WHERE retired_at IS NOT NULL` 部分索引。

CREATE INDEX IF NOT EXISTS idx_source_line_aliases_retired_at
  ON source_line_aliases (retired_at)
  WHERE retired_at IS NOT NULL;

-- ── 5. 验证（DO 块 / 4 列 + 2 索引 + 1 CHECK）─────────────────────────

DO $$
DECLARE
  v_col_count INT;
  v_idx_count INT;
BEGIN
  SELECT COUNT(*) INTO v_col_count
    FROM information_schema.columns
    WHERE table_name = 'source_line_aliases'
      AND column_name IN ('codename', 'priority', 'retired_at', 'auto_retired');

  IF v_col_count <> 4 THEN
    RAISE EXCEPTION 'Migration 079: source_line_aliases 4 列添加失败，期望 4，实际 %', v_col_count;
  END IF;

  SELECT COUNT(*) INTO v_idx_count
    FROM pg_indexes
    WHERE tablename = 'source_line_aliases'
      AND indexname IN ('idx_source_line_aliases_codename_active', 'idx_source_line_aliases_retired_at');

  IF v_idx_count <> 2 THEN
    RAISE EXCEPTION 'Migration 079: 2 索引添加失败，期望 2，实际 %', v_idx_count;
  END IF;

  RAISE NOTICE 'Migration 079 OK: source_line_aliases 4 列 + 2 索引 + 1 CHECK 添加完成';
END $$;

COMMIT;

-- ── ROLLBACK SQL ──────────────────────────────────────────────────
--
-- BEGIN;
-- DROP INDEX IF EXISTS idx_source_line_aliases_retired_at;
-- DROP INDEX IF EXISTS idx_source_line_aliases_codename_active;
-- ALTER TABLE source_line_aliases DROP CONSTRAINT IF EXISTS chk_source_line_aliases_priority_range;
-- ALTER TABLE source_line_aliases
--   DROP COLUMN IF EXISTS auto_retired,
--   DROP COLUMN IF EXISTS retired_at,
--   DROP COLUMN IF EXISTS priority,
--   DROP COLUMN IF EXISTS codename;
-- COMMIT;
