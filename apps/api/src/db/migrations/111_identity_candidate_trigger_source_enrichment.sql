-- 111_identity_candidate_trigger_source_enrichment.sql
-- 描述：identity_candidate.trigger_source CHECK 扩值 +'enrichment'（外部 ID 绑定后定向重评）
-- 日期：2026-06-11
-- 任务卡：BUGFIX-IDENTITY-ENRICH-RESCORE（SEQ-20260611-02）
-- 决策真源：ADR-105a 体系延伸实施（D-105a-16/17 同口径；对齐 CHG-VIR-10「无新表无端点」先例）
-- 幂等：是（DROP IF EXISTS + ADD，重跑收敛同终态）
--
-- ⚠️ 事务：由 scripts/migrate.ts 外层 BEGIN/COMMIT 包裹，本文件内不写 BEGIN/COMMIT（105 先例）。
--
-- 背景：ingest shadow scoring 是一次性快照，enrichment 异步补强外部 ID 证据后无重评机制
--   （实测案例：两部同名视频 ingest 时 bangumi id 晚 5-9 分钟未绑 → 纯标题分低于候选门槛
--   不落行 → 永久缺席合并预选）。新增 trigger_source='enrichment' 标记外部 ID 绑定触发的
--   定向重评（worker job type 'video-rescore'），与 ingest/offline-rescore 来源可区分切片。

ALTER TABLE identity_candidate
  DROP CONSTRAINT IF EXISTS identity_candidate_trigger_source_check;

ALTER TABLE identity_candidate
  ADD CONSTRAINT identity_candidate_trigger_source_check
  CHECK (trigger_source IN ('ingest', 'offline-rescore', 'manual-search', 'enrichment'));

-- ── down ─────────────────────────────────────────────────────────────────────
-- ALTER TABLE identity_candidate DROP CONSTRAINT IF EXISTS identity_candidate_trigger_source_check;
-- ALTER TABLE identity_candidate ADD CONSTRAINT identity_candidate_trigger_source_check
--   CHECK (trigger_source IN ('ingest', 'offline-rescore', 'manual-search'));
-- （注意：down 前需确认无 trigger_source='enrichment' 存量行，否则 ADD 失败）
