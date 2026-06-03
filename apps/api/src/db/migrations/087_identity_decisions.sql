-- 087_identity_decisions.sql
-- 描述：identity 候选人工裁定决策表（SEQ-20260602-03 / CHG-VIR-9-B / Phase 2c）
--   schema 真源 = ADR-105a D-105a-11（confirmed→merge 事务边界 / R8 不形成两套事实源）+ ADR-178（reject 端点）。
--   记录人工对 identity_candidate 的 confirmed（→触发 video merge，关联 video_merge_audit.id）/ rejected 裁定。
--   confirmed 行被 unmerge 撤销时原地置 reverted_at（不改 decision 值、不新增行 / 对齐 video_merge_audit 范式）。
-- 日期：2026-06-03
-- 幂等：是（IF NOT EXISTS）
-- ADR: ADR-105a D-105a-11 / R8（confirmed 必关联 audit）/ R6（复活链已在 086）/ ADR-178 D-178-5
--
-- 索引设计 4 步核验（db-rules.md）：
--   1. 索引键：见下 3 索引（含 1 partial unique 幂等护栏）
--   2. 部分索引 WHERE：① partial unique (candidate_id) WHERE decision='confirmed'（一 candidate 至多 confirm 一次）；
--      ② audit 反查索引 WHERE video_merge_audit_id IS NOT NULL（rejected 行 NULL 不入索引，高选择性）
--   3. driving 谓词：① unmerge 经 video_merge_audit_id 反查关联 decision → 标 reverted（idx_identity_decision_audit）；
--      ② 按 candidate_id 反查该候选历史裁定（idx_identity_decision_candidate）；
--      ③ confirm 幂等护栏：同 candidate 不可被 confirm 两次（uq_identity_decision_candidate_confirmed）
--   4. 匹配判定：3 索引覆盖各 driving 谓词

BEGIN;

CREATE TABLE IF NOT EXISTS identity_decisions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 关联候选（ON DELETE CASCADE：candidate 随 video CASCADE 删时 decision 无独立意义，
  -- 审计血缘真源是 video_merge_audit / R8）
  candidate_id          UUID        NOT NULL REFERENCES identity_candidate(id) ON DELETE CASCADE,
  -- 裁定类型（本卡只写 confirmed/rejected；reverted 由 confirmed 行原地置 reverted_at 表达，非独立 decision 值）
  decision              TEXT        NOT NULL CHECK (decision IN ('confirmed','rejected')),
  -- 关联 video_merge_audit（confirmed→merge 同事务 INSERT 后回填 id / R8）。ON DELETE RESTRICT：
  -- audit 是事实源不可因 decision 被删（对齐 audit.performed_by ON DELETE RESTRICT 防删范式）。
  video_merge_audit_id  UUID        NULL REFERENCES video_merge_audit(id) ON DELETE RESTRICT,
  -- 决策人（human 路径恒有真实 admin user；对齐 video_merge_audit.performed_by 类型语义）
  performed_by          UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  -- actor 类型（D-105a-11：auto decision 用 system actor 作审计血缘）。本卡只写 'human'，预留 'system'。
  actor_type            TEXT        NOT NULL DEFAULT 'human' CHECK (actor_type IN ('human','system')),
  reason                TEXT        NULL,
  -- reverted 元数据（unmerge 撤销 confirmed 时原地置位 / 对齐 video_merge_audit reverted 三列范式 052）
  reverted_at           TIMESTAMPTZ NULL,
  reverted_by           UUID        NULL REFERENCES users(id) ON DELETE RESTRICT,
  reverted_reason       TEXT        NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- R8：confirmed 裁定必关联 video_merge_audit.id（不形成两套事实源）
  CONSTRAINT ck_identity_decision_confirmed_audit
    CHECK (decision <> 'confirmed' OR video_merge_audit_id IS NOT NULL),
  -- reverted 一致性（对齐 video_merge_audit_revert_consistency 范式）
  CONSTRAINT ck_identity_decision_revert_consistency
    CHECK ((reverted_at IS NULL AND reverted_by IS NULL)
        OR (reverted_at IS NOT NULL AND reverted_by IS NOT NULL))
);

-- 索引 1（confirm 幂等护栏 / R8 关联唯一性）：同一 candidate 至多一条 confirmed decision。
--   driving：merge 挂 decision 前不应对已 confirm 的 candidate 再次 confirm（DB 兜底防重复合并记录）。
--   注意：rejected 不入此约束 → reject 后复活（R6 新建另一 candidate 行）再 reject 挂不同 candidate_id 不撞约束。
CREATE UNIQUE INDEX IF NOT EXISTS uq_identity_decision_candidate_confirmed
  ON identity_decisions (candidate_id) WHERE decision = 'confirmed';

-- 索引 2（unmerge 联动反查 / D-105a-11 reverted）：经 video_merge_audit_id 反查关联 decision。
--   driving：unmerge(auditId) → SELECT decision WHERE video_merge_audit_id = $1 → 标 reverted。
--   partial WHERE 非空：仅 confirmed 行有 audit_id，rejected 行 NULL 不入索引（高选择性）。
CREATE INDEX IF NOT EXISTS idx_identity_decision_audit
  ON identity_decisions (video_merge_audit_id) WHERE video_merge_audit_id IS NOT NULL;

-- 索引 3（按 candidate 反查历史裁定 / 审计 + reject 幂等读）
--   driving：findDecisionsByCandidate / 报表 join candidate。
CREATE INDEX IF NOT EXISTS idx_identity_decision_candidate
  ON identity_decisions (candidate_id);

COMMIT;

-- 验证（参 migration 086 DO 范式）
DO $$
DECLARE col_count INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'identity_decisions') THEN
    RAISE EXCEPTION 'Migration 087 failed: identity_decisions table not created';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_identity_decision_candidate_confirmed') THEN
    RAISE EXCEPTION 'Migration 087 failed: uq_identity_decision_candidate_confirmed index not created';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_identity_decision_audit') THEN
    RAISE EXCEPTION 'Migration 087 failed: idx_identity_decision_audit index not created';
  END IF;
  -- R8 CHECK 约束存在性核验（confirmed 必有 audit）
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_identity_decision_confirmed_audit'
  ) THEN
    RAISE EXCEPTION 'Migration 087 failed: R8 CHECK ck_identity_decision_confirmed_audit 缺失';
  END IF;
  SELECT COUNT(*) INTO col_count FROM information_schema.columns
   WHERE table_name = 'identity_decisions'
     AND column_name IN ('candidate_id','decision','video_merge_audit_id','performed_by',
                         'actor_type','reverted_at','reverted_by');
  IF col_count < 7 THEN
    RAISE EXCEPTION 'Migration 087 failed: identity_decisions 关键列缺失，期望 7 实际 %', col_count;
  END IF;
  RAISE NOTICE 'Migration 087 OK: identity_decisions 已创建（R8 CHECK + 3 索引）';
END $$;
