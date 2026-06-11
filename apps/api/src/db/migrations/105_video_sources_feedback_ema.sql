-- 105_video_sources_feedback_ema.sql
-- 描述：video_sources 新增播放反馈 EMA 衰减统计三字段（写入侧即时半衰，无 cron / 无全表 UPDATE）
-- 日期：2026-06-10
-- 方案真源：docs/designs/source-health-feedback-loop-plan_20260610.md §3 P2-2 / §8.4 Q3 改判（EMA）
-- 任务卡：SRCHEALTH-P2-2 / SEQ-20260610-02
-- 子代理：arch-reviewer (claude-opus-4-8) 两轮裁决（schema + 半衰公式 + 并发安全 SQL 形态）
-- 幂等：是（ADD COLUMN IF NOT EXISTS；三列 NULL 无 backfill）
--
-- ⚠️ 事务：由 scripts/migrate.ts 外层 BEGIN/COMMIT 包裹，本文件内不写 BEGIN/COMMIT
--    （054/059/104 文件内嵌 BEGIN 会触发 PG "already a transaction" warning + 内层 COMMIT
--     提前提交外层事务，属既有技术债；arch-reviewer 裁决新文件不复制该模式）。
--
-- 三列均 NULL（无 DEFAULT）：NULL = "无样本" 唯一正确语义；
-- P3-2 进分前（影子验证门禁，方案 §4 时序硬依赖链）本表字段只写不读。

ALTER TABLE video_sources
  ADD COLUMN IF NOT EXISTS fb_score          NUMERIC
    CHECK (fb_score IS NULL OR (fb_score >= 0 AND fb_score <= 1)),
  ADD COLUMN IF NOT EXISTS fb_sample_weight  NUMERIC
    CHECK (fb_sample_weight IS NULL OR fb_sample_weight >= 0),
  ADD COLUMN IF NOT EXISTS last_feedback_at  TIMESTAMPTZ;

COMMENT ON COLUMN video_sources.fb_score
  IS 'EMA 平滑播放成功率 [0,1]；裸 NUMERIC 防多轮 round 漂移；NULL=无样本；写入侧即时半衰（feedback.ts FB_HALF_LIFE_SECONDS）。本卡（P2-2）只写不进评分，进分见 P3-2（影子验证硬前置）';
COMMENT ON COLUMN video_sources.fb_sample_weight
  IS 'EMA 有效样本权重；稳态上界≈1/(1-2^(-Δt̄/T))；NULL=无样本。⚠️ P3-2 消费 min(1,w/N) 时须 COALESCE(w,0)——PG LEAST 忽略 NULL 会误返 1 让无样本源拿满置信度';
COMMENT ON COLUMN video_sources.last_feedback_at
  IS '最近一次播放反馈时间；半衰 decay 基准（NOW()-last_feedback_at）；NULL→decay 强制 0→首样本 fb_score=obs/weight=1 无先验初始化';

-- 不建索引：评分 JOIN 在 P3-2，本卡 feedback 按 id 主键写入，无独立查询路径（避免写放大 + YAGNI）

-- ── down ─────────────────────────────────────────────────────────────────────
-- ALTER TABLE video_sources
--   DROP COLUMN IF EXISTS last_feedback_at,
--   DROP COLUMN IF EXISTS fb_sample_weight,
--   DROP COLUMN IF EXISTS fb_score;
