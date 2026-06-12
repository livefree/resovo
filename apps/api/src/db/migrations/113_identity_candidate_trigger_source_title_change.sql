-- 113_identity_candidate_trigger_source_title_change.sql
-- 描述：identity_candidate.trigger_source CHECK 扩值 +'title_change'（标题变更后定向重评）
-- 日期：2026-06-12
-- 任务卡：GOV-4（SEQ-20260612-03 合并候选与视频标题综合治理）
-- 决策真源：治理序列缺陷 B（标题变更无 hook）；对齐 migration 111「无新表无端点」先例
-- 幂等：是（DROP IF EXISTS + ADD，重跑收敛同终态）
--
-- ⚠️ 事务：由 scripts/migrate.ts 外层 BEGIN/COMMIT 包裹，本文件内不写 BEGIN/COMMIT（105 先例）。
--
-- 背景：admin 手工改标题 / 运维批量标题清洗（VIDEO-NAMING-STANDARD-B 清洗 544 行使
--   「重案解密 国语/粤语」们标题趋同）恰是制造合并候选的时机，但此前无任何机制触达
--   候选重评（治理缺陷 B）。新值标记标题变更触发的定向重评，与 ingest / offline-rescore /
--   enrichment 来源可区分切片。

ALTER TABLE identity_candidate
  DROP CONSTRAINT IF EXISTS identity_candidate_trigger_source_check;

ALTER TABLE identity_candidate
  ADD CONSTRAINT identity_candidate_trigger_source_check
  CHECK (trigger_source IN ('ingest', 'offline-rescore', 'manual-search', 'enrichment', 'title_change'));

-- ── down ─────────────────────────────────────────────────────────────────────
-- ALTER TABLE identity_candidate DROP CONSTRAINT IF EXISTS identity_candidate_trigger_source_check;
-- ALTER TABLE identity_candidate ADD CONSTRAINT identity_candidate_trigger_source_check
--   CHECK (trigger_source IN ('ingest', 'offline-rescore', 'manual-search', 'enrichment'));
-- （注意：down 前需确认无 trigger_source='title_change' 存量行，否则 ADD 失败）
