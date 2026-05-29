-- 081_source_line_aliases_dead_since.sql
-- 描述：source_line_aliases 新增 dead_since 列，供 PRE-DEAD-LINE-AUTO-RETIRE-WORKER 实施
--       记录该 alias「全部关联 video_sources 全 dead」的起始时间戳；
--       由 worker 单向维护（不影响既有 probe / render 写路径 / Wave 4 #5 arch-reviewer 评审方案 D'）；
--       上升沿：alias 当前全 dead 且 dead_since IS NULL → SET NOW()
--       下降沿：alias 任一 source 转非 dead 或孤儿（无 source） → SET NULL
--       触发：dead_since IS NOT NULL AND dead_since < NOW() - INTERVAL '180 days'
--         → UPDATE retired_at = NOW(), auto_retired = true
-- 日期：2026-05-28
-- ADR：ADR-164 D-164-8（worker 自动退役 / 共用 retired_at + auto_retired / 不写 admin audit）
-- 任务卡：CHG-PRE-DEAD-LINE-AUTO-RETIRE-WORKER-A / SEQ-20260528-MOD-WAVE4
-- 子代理：arch-reviewer (claude-opus-4-7) / A- CONDITIONAL / 4 红线 R-DEAD-1/2/3/4 已吸收
-- 幂等：是（ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS / DO 块 information_schema 守卫）
--
-- 字段语义：
--   dead_since TIMESTAMPTZ NULL — alias 整体「全 dead」起始时间戳
--     NULL  = 当前非全 dead 或尚未观察
--     非 NULL = 已进入 dead 观察期（180 天后自动退役）
--
-- 设计判据（详 arch-reviewer Opus 评审）：
--   方案 D' 选择理由（vs A 在 video_sources 加列 / B last_probed_at 近似 / C event log CTE）：
--     - 零写路径侵入：不动 level1-probe / level2-render / feedback-driven 三处既有 worker job
--     - 概念对齐：alias 治理粒度 / dead_since 应在 alias 表（D-164-8 设计原意）
--     - 简化 SQL：单表 SELECT-then-UPDATE，无 GROUP BY MIN/MAX 复杂表达式
--     - 历史安全：worker 首次启用 → dead_since 从启用时算起 → 自然 180 天延迟（特性而非 bug）
--     - 测试可控：mock alias 表足够 / 不需 mock 多 worker 写路径

BEGIN;

-- ── 1. 列扩展 ─────────────────────────────────────────────────────

ALTER TABLE source_line_aliases
  ADD COLUMN IF NOT EXISTS dead_since TIMESTAMPTZ NULL;

COMMENT ON COLUMN source_line_aliases.dead_since
  IS 'alias 整体「全 dead」起始时间戳 / NULL=非全 dead 或未观察 / 由 auto-retire-line worker 单向维护（不影响 probe/render 写路径）/ dead_since < NOW() - 180 days 触发自动退役 / ADR-164 D-164-8 / CHG-PRE-DEAD-LINE-AUTO-RETIRE-WORKER';

-- ── 2. 部分索引：仅「已进入 dead 观察期 + 未退役」入索引（worker hot path） ──

CREATE INDEX IF NOT EXISTS idx_source_line_aliases_dead_since
  ON source_line_aliases (dead_since)
  WHERE dead_since IS NOT NULL AND retired_at IS NULL;

COMMENT ON INDEX idx_source_line_aliases_dead_since
  IS '部分索引：dead_since IS NOT NULL AND retired_at IS NULL / 服务 auto-retire-line worker 段 3 检测 SQL / ORDER BY dead_since ASC 优先退役最老 alias';

-- ── 3. 自检：列 + 索引必须存在 ─────────────────────────────────────

DO $$
DECLARE
  v_col_count INT;
  v_idx_count INT;
BEGIN
  SELECT COUNT(*) INTO v_col_count
  FROM information_schema.columns
  WHERE table_name = 'source_line_aliases' AND column_name = 'dead_since';

  IF v_col_count <> 1 THEN
    RAISE EXCEPTION 'Migration 081 失败：source_line_aliases.dead_since 列未添加';
  END IF;

  SELECT COUNT(*) INTO v_idx_count
  FROM pg_indexes
  WHERE schemaname = current_schema()
    AND tablename = 'source_line_aliases'
    AND indexname = 'idx_source_line_aliases_dead_since';

  IF v_idx_count <> 1 THEN
    RAISE EXCEPTION 'Migration 081 失败：idx_source_line_aliases_dead_since 索引未创建';
  END IF;

  RAISE NOTICE 'Migration 081 OK: source_line_aliases.dead_since (1 col + 1 partial index)';
END $$;

COMMIT;

-- ── ROLLBACK（注释 / 仅参考）─────────────────────────────────────────
-- BEGIN;
-- DROP INDEX IF EXISTS idx_source_line_aliases_dead_since;
-- ALTER TABLE source_line_aliases DROP COLUMN IF EXISTS dead_since;
-- COMMIT;
