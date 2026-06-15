-- 119_metadata_field_proposals.sql
-- 描述：多源交叉验证编排字段级载体——新建 metadata_field_proposals 表，承载每字段多源
--   候选值（proposal）+ 逻辑 winner + 实际 applied + 冲突态。reconcile（gather→reconcile→write）
--   的字段级比对/背书/冲突输入由本表承载；video_metadata_provenance 保持 last-writer SSOT 不动。
-- 日期：2026-06-15
-- 决策真源：docs/decisions.md ADR-205 §D-205-2（schema + M6 不变量 + is_winner/applied 双列）
--   / §D-205-6（conflict 行批量读 → derive 注入 needs_review）
-- 任务卡：META-49-A / SEQ-20260615-02（META-49 拆 -A/-B/-C/-D 第 1 子卡，纯数据层）
-- 子代理：无（schema 已 ADR-205 D-205-2 定形 + arch-reviewer aa7acbacca478ea7c CONDITIONAL-PASS；本卡落地）
-- 幂等：是（CREATE TABLE/INDEX IF NOT EXISTS；可重复执行）
--
-- ⚠️ 事务：由 scripts/migrate.ts 外层 BEGIN/COMMIT 包裹，本文件内不写 BEGIN/COMMIT（105/112/115 先例）。
-- ⚠️ Down 路径：注释形式留存（项目约定）。
--
-- D-205-2：每字段多行（每源一行）。`proposed_value` JSONB 统一承载标量/数组，reconcile 比较前经
--   canonical 归一（D-205-3：数组排序集合相等 / 字符串 trim+大小写归一 / 数值容差）。
-- 🔴 M6 不变量：PK (catalog_id, field_name, source_kind) 隐含「同源同字段至多一 proposal」——
--   douban step1/step2 互斥（MetadataEnrichService.ts:101-109）当前安全；未来 douban 多路并行须重启评估。
-- is_winner（逻辑 winner）vs applied（实际落 catalog）双列：区分 M1 方案 A 降级 skip 场景——
--   reconcile 选出逻辑 winner 但因 safeUpdate 优先级闸门未落库时 is_winner=true, applied=false，
--   表内 winner 与 catalog 真实值不脱钩（D-205-4 / 观察 O-205-2）。

CREATE TABLE IF NOT EXISTS metadata_field_proposals (
  catalog_id     UUID        NOT NULL REFERENCES media_catalog(id) ON DELETE CASCADE,
  field_name     TEXT        NOT NULL,
  source_kind    TEXT        NOT NULL,
  source_ref     TEXT        NULL,
  proposed_value JSONB       NOT NULL,
  confidence     NUMERIC     NULL,
  is_winner      BOOLEAN     NOT NULL DEFAULT FALSE,
  applied        BOOLEAN     NOT NULL DEFAULT FALSE,
  conflict_state TEXT        NULL,
  proposed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (catalog_id, field_name, source_kind)
);

COMMENT ON TABLE metadata_field_proposals
  IS '多源交叉验证字段级载体（ADR-205 D-205-2）：每 catalog 每字段每源一行 proposal。reconcile 逐字段裁决的候选/winner/冲突输入；video_metadata_provenance 仍为 last-writer SSOT，二者正交。';
COMMENT ON COLUMN metadata_field_proposals.source_kind
  IS '提案来源（douban/bangumi/tmdb/...，开放字符串对齐 video_metadata_provenance.source_kind 无 CHECK）。trust 派生 CATALOG_SOURCE_PRIORITY[source_kind]，禁另立平行硬编码（D-205-3）。';
COMMENT ON COLUMN metadata_field_proposals.source_ref
  IS '该源外部 ID（douban subject / bangumi subject / tmdb id），可空。';
COMMENT ON COLUMN metadata_field_proposals.proposed_value
  IS 'JSONB 统一承载标量/数组候选值；reconcile 比较前经 canonical 归一（D-205-3：数组排序集合相等 / 字符串 trim+大小写归一 / 数值容差）防假 needs_review。';
COMMENT ON COLUMN metadata_field_proposals.is_winner
  IS '逻辑 winner（reconcile 裁决胜出）；与 applied 解耦——M1 降级 skip 时 is_winner=true、applied=false（D-205-4 / O-205-2）。';
COMMENT ON COLUMN metadata_field_proposals.applied
  IS '实际经 safeUpdate 落 media_catalog（优先级闸门放行后为 TRUE）。';
COMMENT ON COLUMN metadata_field_proposals.conflict_state
  IS '跨源冲突标记（reconcile 写 / derive 读注入 needs_review，D-205-6），可空开放字符串；NULL=无冲突。';

-- ── 索引：conflict 行批量读（D-205-6，避 cell N+1）─────────────────────────────────
-- db-rules 索引 4 步核验：
--   ① 查询形态：49-C sibling 批量查询 `WHERE catalog_id = ANY($1) AND conflict_state IS NOT NULL`
--      （对齐 getMetadataProviderRefs 范式，喂 derive fieldConflicts 输入通道）。
--   ② 选择性：conflict 行在全表中稀少（多源一致为常态）→ partial index 只索引冲突子集，体积小。
--   ③ 与 PK 区隔：PK (catalog_id,...) 前缀虽可服务 catalog_id 查询，但全行扫描含大量非冲突行；
--      partial WHERE conflict_state IS NOT NULL 直接定位冲突行，批量 ANY 查询更优。
--   ④ 写放大：仅冲突行进入索引，常态非冲突写入不触及该 partial index，写开销可忽略。
CREATE INDEX IF NOT EXISTS idx_metadata_field_proposals_conflict
  ON metadata_field_proposals (catalog_id)
  WHERE conflict_state IS NOT NULL;

-- ── down ─────────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS metadata_field_proposals;
