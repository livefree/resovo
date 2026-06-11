-- 109_video_sources_admin_playback_verify.sql
-- 描述：admin 审核台真实播放反馈并入 source health 的 schema 增量
--       （新列 last_admin_verified_at + admin_playback 失败信号定向 recheck partial index）
-- 日期：2026-06-11
-- 决策真源：docs/decisions.md ADR-198 §决策要点 D-198-5 / D-198-8 + §Schema（migration 109 草案）
-- 任务卡：SRCHEALTH-ADMIN-PLAYBACK-FB-A / 拆卡 -A
-- 子代理：arch-reviewer (claude-opus-4-8) — ADR-198 CONDITIONAL PASS（字段结构裁决已锁定）
-- 幂等：是（ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS；无 backfill）
--
-- ⚠️ 事务：由 scripts/migrate.ts 外层 BEGIN/COMMIT 包裹，本文件内不写 BEGIN/COMMIT（105 先例）。
-- ⚠️ Down 路径：注释形式留存（项目约定）。
--
-- D-198-5：admin 验证是确定性状态写入，经 render_status/probe_status 直接体现；新列仅记录
--   「谁验证的/何时」语义溯源，不混淆 last_rendered_at（备选 D 拒绝：一列成本换语义清晰）。
--   不写 EMA 三字段（D-198-4，本迁移无关 fb_*）。
-- D-198-8：admin 失败不直接置 dead（D-198-2 红线），改记 health_events(origin='admin_playback',
--   processed_at=NULL) 作定向 recheck 信号，复用既有 feedback-driven-recheck worker 定向消费；
--   origin 列 037 起无 CHECK → 新值零列迁移（对齐 106 manual_route_reprobe 先例）；
--   types union 真源 packages/types SourceHealthEventOriginWorker 同位扩展。

ALTER TABLE video_sources
  ADD COLUMN IF NOT EXISTS last_admin_verified_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN video_sources.last_admin_verified_at
  IS 'admin 审核台真实播放亲验时间戳（ADR-198）。NULL=从未被 admin 真实播放亲验；非 NULL=最近一次 playback-verify 成功时刻，驱动 P3-1 双时钟 render 维度衰减回升语义溯源，区别于爬虫/众包的 last_rendered_at/last_feedback_at';

-- admin 失败定向 recheck 信号队列：worker 拉取未处理 admin_playback 事件（D-198-8）。
-- partial 谓词 origin='admin_playback' AND processed_at IS NULL → 初始空索引瞬时完成，无锁等待
--   （migrate.ts 事务内禁 CONCURRENTLY，此空表谓词形态安全；语义同 058a/106 待处理队列）。
CREATE INDEX IF NOT EXISTS idx_health_events_admin_playback_pending
  ON source_health_events (source_id)
  WHERE origin = 'admin_playback' AND processed_at IS NULL;

-- ── down ─────────────────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS idx_health_events_admin_playback_pending;
-- ALTER TABLE video_sources DROP COLUMN IF EXISTS last_admin_verified_at;
