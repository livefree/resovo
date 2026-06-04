-- 092_catalog_merge_snapshots.sql
-- 描述：catalog-catalog 合并快照表集（SEQ-20260602-03 / CHG-VIR-12-F / Phase 5f）
--   本 migration **仅建快照表（DDL only，无任何 DML）**，安全可重复执行（084 范式严格继承 /
--   ADR-176 D-176-4 + R3）。合并/回滚由 CatalogMergeService 原语 + 运维脚本承担
--   （D-176-10：脚本先行不起 admin 端点；原语落 Service 层供未来端点复用）：
--     scripts/catalog-merge.ts           指定 loser→survivor 合并（默认 dry-run）
--     scripts/catalog-merge-rollback.ts  按 merge_op_id 回滚（数据安全网非字节级无损）
--
-- 相对 084 的增量（ADR-176/177 落地后的新 CASCADE 子表）：
--   + _bak_catalog_relations_092       （D-176-4 R-2：端点重指向 survivor，快照原行回滚复位）
--   + _bak_catalog_external_refs_092   （D-177-9 R8：exact 索引① 预检重指向，快照留痕）
--   + _bak_catalog_merge_ops_092       （合并操作注册表：loser/survivor + survivor 四列 cache
--                                        合并前快照〔cache 重算 D-177-9 的回滚复位源〕）
-- 回滚改进（vs 084 sentinel）：092 不覆盖任何留存行键 → loser 原行恢复不撞唯一键，无需 sentinel
--   （loser 与 survivor 合并前本就共存）；ON CONFLICT (id) DO NOTHING 仅兜重复回滚。
--
-- 幂等：全部 IF NOT EXISTS。

BEGIN;

-- ── 合并操作注册表（一次合并一行；回滚入口按 id 检索）──────────────
CREATE TABLE IF NOT EXISTS _bak_catalog_merge_ops_092 (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  loser_catalog_id        UUID        NOT NULL,
  survivor_catalog_id     UUID        NOT NULL,
  -- survivor 四列 cache 合并前快照（D-177-9 cache 重算的回滚复位源）
  survivor_cache_snapshot JSONB       NOT NULL DEFAULT '{}'::jsonb,
  performed_by            TEXT,
  performed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rolled_back_at          TIMESTAMPTZ NULL
);

-- ── 主表快照：被删 loser 行全字段 + 合并元数据 ──────────────────────
CREATE TABLE IF NOT EXISTS _bak_media_catalog_092 (
  LIKE media_catalog INCLUDING DEFAULTS    -- 不 INCLUDING CONSTRAINTS/INDEXES：快照须能存重复行
);
ALTER TABLE _bak_media_catalog_092
  ADD COLUMN IF NOT EXISTS merge_op_id UUID        NOT NULL,
  ADD COLUMN IF NOT EXISTS snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ── CASCADE 子表 + 孙表快照（084 同构 + merge_op_id）────────────────
CREATE TABLE IF NOT EXISTS _bak_catalog_episodes_092          (LIKE catalog_episodes          INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS _bak_catalog_characters_092        (LIKE catalog_characters        INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS _bak_catalog_character_actors_092  (LIKE catalog_character_actors  INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS _bak_video_metadata_provenance_092 (LIKE video_metadata_provenance INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS _bak_video_metadata_locks_092      (LIKE video_metadata_locks      INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS _bak_media_catalog_aliases_092     (LIKE media_catalog_aliases     INCLUDING DEFAULTS);
-- ADR-176/177 新 CASCADE 子表（084 时不存在）
CREATE TABLE IF NOT EXISTS _bak_catalog_relations_092         (LIKE catalog_relations         INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS _bak_catalog_external_refs_092     (LIKE catalog_external_refs     INCLUDING DEFAULTS);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    '_bak_catalog_episodes_092', '_bak_catalog_characters_092', '_bak_catalog_character_actors_092',
    '_bak_video_metadata_provenance_092', '_bak_video_metadata_locks_092',
    '_bak_media_catalog_aliases_092', '_bak_catalog_relations_092', '_bak_catalog_external_refs_092'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS merge_op_id UUID NOT NULL', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW()', t);
  END LOOP;
END $$;

-- ── videos 重指向快照（回滚复位 catalog_id 原值；084:41-47 范式 + merge_op_id）──
CREATE TABLE IF NOT EXISTS _bak_videos_catalog_id_092 (
  video_id        UUID        NOT NULL,
  old_catalog_id  UUID,
  new_catalog_id  UUID,
  merge_op_id     UUID        NOT NULL,
  snapshot_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;

-- 验证（DO 范式）
DO $$
DECLARE n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM information_schema.tables
   WHERE table_name IN (
     '_bak_catalog_merge_ops_092', '_bak_media_catalog_092',
     '_bak_catalog_episodes_092', '_bak_catalog_characters_092', '_bak_catalog_character_actors_092',
     '_bak_video_metadata_provenance_092', '_bak_video_metadata_locks_092',
     '_bak_media_catalog_aliases_092', '_bak_catalog_relations_092', '_bak_catalog_external_refs_092',
     '_bak_videos_catalog_id_092'
   );
  IF n < 11 THEN
    RAISE EXCEPTION 'Migration 092 failed: 快照表缺失，期望 11 实际 %', n;
  END IF;
  RAISE NOTICE 'Migration 092 OK: catalog 合并快照表集 11 张已就绪（DDL only 零 DML）';
END $$;
