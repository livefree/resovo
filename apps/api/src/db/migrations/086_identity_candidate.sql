-- 086_identity_candidate.sql
-- 描述：视频身份候选 shadow 表（SEQ-20260602-03 / CHG-VIR-8 / Phase 2b）
--   schema 真源 = ADR-105a D-105a-7（DDL 草案 decisions.md:18972-18997）。
--   离线 Bull job（Blocking 并集召回 → 多证据 Scoring → 单事务幂等 upsert）持久化 video-pair
--   候选，与现有实时 group-by 候选并行对照（不切 UI / Phase 2c 才切）。
-- 日期：2026-06-03
-- 幂等：是（IF NOT EXISTS）
-- ADR: ADR-105a D-105a-7（schema+状态机+R5/R6）/ D-105a-8（evidence_hash）/ D-105a-10（离线 job）
--
-- 索引设计 4 步核验（db-rules.md）：
--   1. 索引键：见下 5 索引 + 1 blocking 支撑索引注释
--   2. 部分索引 WHERE：uq pending（status='pending'）保证同 pair 至多一条 pending
--   3. driving 谓词：① upsert 幂等命中 canonical_pair_key+pending；② findPendingByPairKey；
--      ③ 报表按 status+scorer/parser_version 过滤；④ blocking 召回反查 left/right video_id；
--      ⑤ 离线 job 按 core_title_key 分桶召回（title_observations 表达式索引）
--   4. 匹配判定：6 索引完整覆盖各 driving 谓词

BEGIN;

CREATE TABLE IF NOT EXISTS identity_candidate (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  left_video_id               UUID        NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  right_video_id              UUID        NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  canonical_pair_key          TEXT        NOT NULL,   -- "min(video_id)|max(video_id)" 有序规范键
  status                      TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','confirmed','rejected','superseded')),
  parser_version              TEXT        NOT NULL,
  scorer_version              TEXT        NOT NULL,
  evidence_jsonb              JSONB       NOT NULL,
  evidence_hash               TEXT        NOT NULL,   -- D-105a-8 输入域 sha256 hex
  legacy_score                NUMERIC(5,4),           -- 可空（跨 group pair 无对应 legacy group）
  identity_score              NUMERIC(5,4) NOT NULL,
  strong_negative_reasons     TEXT[]      NOT NULL DEFAULT '{}',
  trigger_source              TEXT        NOT NULL
                              CHECK (trigger_source IN ('ingest','offline-rescore','manual-search')),
  group_key                   TEXT        NULL,       -- Phase 2a N-video group 折叠展示用
  -- 自引用 FK ON DELETE SET NULL：删一条候选不连锁删整条复活/supersede 链（保审计 R6 不断链）
  revived_from_candidate_id   UUID        NULL REFERENCES identity_candidate(id) ON DELETE SET NULL,
  superseded_by_candidate_id  UUID        NULL REFERENCES identity_candidate(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 防自引用 pair（left==right 无意义）
  CONSTRAINT ck_identity_candidate_distinct_videos CHECK (left_video_id <> right_video_id),
  -- canonical 有序不变量：left < right（文本序）。DB 兜底防 Service 写反序导致同 pair 两个
  -- canonical_pair_key 绕过 partial unique（幂等失效的最隐蔽路径）
  CONSTRAINT ck_identity_candidate_ordered CHECK (left_video_id::text < right_video_id::text)
);

-- 索引 1（R5 / D-105a-7）：并发幂等 partial unique —— 同 pair 至多一条 pending
--   driving：upsert 单事务 ON CONFLICT 推断 + findPendingByPairKey
CREATE UNIQUE INDEX IF NOT EXISTS uq_identity_candidate_pending
  ON identity_candidate (canonical_pair_key) WHERE status = 'pending';

-- 索引 2：canonical_pair_key 全状态反查（复活链查原 rejected / 历史审计 / 报表 join）
CREATE INDEX IF NOT EXISTS idx_identity_candidate_pair_key
  ON identity_candidate (canonical_pair_key);

-- 索引 3：版本过滤读（Y5 双写 + version 过滤 / 报表口径）
--   driving：报表/读侧 WHERE status=$ AND scorer_version=$ AND parser_version=$
CREATE INDEX IF NOT EXISTS idx_identity_candidate_status_version
  ON identity_candidate (status, scorer_version, parser_version);

-- 索引 4：left_video_id FK 反查（blocking 召回 / ON DELETE CASCADE 反查 / 报表 join videos）
CREATE INDEX IF NOT EXISTS idx_identity_candidate_left_video
  ON identity_candidate (left_video_id);

-- 索引 5：right_video_id FK 反查
CREATE INDEX IF NOT EXISTS idx_identity_candidate_right_video
  ON identity_candidate (right_video_id);

-- 索引 6（blocking 召回支撑 / D-105a-10「B-tree 覆盖高选择性 blocking key」）：
--   离线 job 按 (parser_version, coreTitleKey) 分桶召回（title_observations 表，CHG-VIR-6 落地）。
--   放本 migration（CHG-VIR-8 范围内），不改已冻结的 085。
--   driving：GROUP BY core_key WHERE parser_version=$ AND core_key > $cursor（keyset 分页）
CREATE INDEX IF NOT EXISTS idx_title_observations_core_key
  ON title_observations (parser_version, (parsed_facets_jsonb->>'coreTitleKey'));

COMMIT;

-- 验证（参 migration 085 DO 范式）
DO $$
DECLARE col_count INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'identity_candidate') THEN
    RAISE EXCEPTION 'Migration 086 failed: identity_candidate table not created';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_identity_candidate_pending') THEN
    RAISE EXCEPTION 'Migration 086 failed: uq_identity_candidate_pending index not created';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_title_observations_core_key') THEN
    RAISE EXCEPTION 'Migration 086 failed: idx_title_observations_core_key (blocking) not created';
  END IF;
  SELECT COUNT(*) INTO col_count FROM information_schema.columns
   WHERE table_name = 'identity_candidate'
     AND column_name IN ('canonical_pair_key','status','evidence_hash','identity_score',
                         'scorer_version','parser_version','revived_from_candidate_id',
                         'superseded_by_candidate_id','trigger_source');
  IF col_count < 9 THEN
    RAISE EXCEPTION 'Migration 086 failed: identity_candidate 关键列缺失，期望 9 实际 %', col_count;
  END IF;
  RAISE NOTICE 'Migration 086 OK: identity_candidate 已创建（6 索引含 blocking 支撑）';
END $$;
