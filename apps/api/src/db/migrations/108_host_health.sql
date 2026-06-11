-- 108_host_health.sql
-- 描述：host_health 新表——hostname 维度熔断持久状态（双存储分工：内存扛热路径判定，本表供评分 JOIN）
-- 日期：2026-06-10
-- 方案真源：docs/designs/source-health-feedback-loop-plan_20260610.md §3 P3-3 / §8.4 Q4 改判
-- 任务卡：SRCHEALTH-P3-3-B1 / SEQ-20260610-02
-- 子代理：arch-reviewer (claude-opus-4-8) 裁决 A–H
-- 幂等：是（CREATE TABLE IF NOT EXISTS；无 backfill——行由 worker 翻转事件按需创建）
--
-- ⚠️ 事务：由 scripts/migrate.ts 外层 BEGIN/COMMIT 包裹，本文件内不写 BEGIN/COMMIT（105/107 先例）。
--
-- 设计要点（裁决 A）：只存「可被 NOW() 自然过期的事实字段」，无 state 枚举——
--   熔断判定 = cooldown_until > NOW()（读时计算），无后台翻转任务、无脏状态窗口；
--   cooldown 到期评分侧自动回升，不等 worker 下轮 cron（裁决 D）。
-- 写路径（裁决 B）：仅熔断翻转事件级 UPSERT（worker level1/level2 拿 CircuitTransition 信号落库），
--   recordFailure/recordSuccess 逐次调用不写库；worker 重启不回灌内存。
-- site_key 不入表（方案 §7.1-1 硬约束）：hostname↔site_key 多对多，经 video_sources.source_hostname 反查。
-- 行数上界 = DISTINCT source_hostname 基数（落地时实测 278），PK 天然去重无膨胀；recovered 不删行（trip_count 观测价值）。

CREATE TABLE IF NOT EXISTS host_health (
  hostname          TEXT PRIMARY KEY
    CHECK (hostname = lower(hostname)),
  cooldown_until    TIMESTAMPTZ,
  last_failure_at   TIMESTAMPTZ,
  last_success_at   TIMESTAMPTZ,
  last_tripped_at   TIMESTAMPTZ,
  trip_count        INTEGER NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE host_health
  IS 'hostname 维度熔断持久状态（SRCHEALTH-P3-3-B1）。双存储分工（方案 Q4）：worker 内存 Map 扛热路径判定（重启失忆可接受），本表存供评分 JOIN 的持久态。hostname 语义真源 = @resovo/media-probe extractHostname（与 video_sources.source_hostname byte-identical 方可 JOIN）';
COMMENT ON COLUMN host_health.hostname
  IS '规范化 hostname（小写 CHECK 对齐 107 不变式）；PK 即唯一键；site_key 不入表（多对多经 video_sources 反查）';
COMMENT ON COLUMN host_health.cooldown_until
  IS '熔断冷却截止。评分侧唯一判定：cooldown_until > NOW() = 熔断中（-B2 LEFT JOIN 取 host_tripped 布尔）；NULL 或已过期 = 正常。到期自然失效，无需后台翻转';
COMMENT ON COLUMN host_health.trip_count
  IS '累计熔断次数（运营观测 CDN 反复抖动用，不进评分路径）';

-- 不建额外索引：PK(hostname) 即 -B2 JOIN 唯一访问路径；行数上界为 hostname 基数（实测 278）

-- ── down ─────────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS host_health;
