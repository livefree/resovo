-- 084_merge_key_backfill_dedup.sql
-- ADR-174 / META-23-C — 归并键剥标点存量重算 + 52 冗余 catalog 合并的「快照备份表」
--
-- 本 migration **仅建快照表（DDL only，无任何 DML）**，安全可重复执行。
-- 真正的存量重算 / 冗余合并 / 删行 由两个独立 TS 脚本承担（R5：归一化须 TS 调
-- normalizeMergeKey，禁纯 SQL 复刻；且合并需「每组一事务 + 断点续跑」，超出 migrate.ts
-- 单文件单事务模型）：
--   scripts/backfill-merge-key.ts   阶段 A：重算 media_catalog.title_normalized
--   scripts/dedup-catalog-084.ts    阶段 B：逐组合并 52 冗余行（删行前写本快照表）
--   scripts/dedup-catalog-084-rollback.ts  回滚预案（从本快照表还原）
--
-- R4（media_catalog 无 deleted_at，删行不可逆）：删行前全字段快照到 _bak_*_084，可回滚。
-- 快照覆盖：主表 + 5 个 CASCADE 子表 + 孙表 catalog_character_actors（删碰撞 character 会
-- CASCADE 连带删 actors，不快照则无法回滚）+ videos 原 catalog_id 指向。
-- 快照表保留至 D-174-5 五类测试全绿 + 线上观察一迭代后，另起清理卡 DROP（不在本卡范围）。
--
-- 幂等：全部 IF NOT EXISTS。

BEGIN;

-- ── 主表快照：被删冗余 catalog 行全字段 + 迁移元数据 ────────────────
CREATE TABLE IF NOT EXISTS _bak_media_catalog_084 (
  LIKE media_catalog INCLUDING DEFAULTS    -- 不 INCLUDING CONSTRAINTS/INDEXES：快照须能存重复行
);
ALTER TABLE _bak_media_catalog_084
  ADD COLUMN IF NOT EXISTS migration_batch TEXT        NOT NULL DEFAULT '084',
  ADD COLUMN IF NOT EXISTS surviving_id    UUID,        -- 该冗余行被合并到的留存行 id（回滚用）
  ADD COLUMN IF NOT EXISTS snapshot_at     TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ── 子表快照（CASCADE 子表，删冗余 catalog 前快照其名下全部子行）────
CREATE TABLE IF NOT EXISTS _bak_catalog_episodes_084          (LIKE catalog_episodes          INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS _bak_catalog_characters_084        (LIKE catalog_characters        INCLUDING DEFAULTS);
-- 孙表：catalog_character_actors.character_id → catalog_characters(id) ON DELETE CASCADE
-- 删碰撞 character 会连带删其 actors，必须快照（R4 盲点）
CREATE TABLE IF NOT EXISTS _bak_catalog_character_actors_084  (LIKE catalog_character_actors  INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS _bak_video_metadata_provenance_084 (LIKE video_metadata_provenance INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS _bak_video_metadata_locks_084      (LIKE video_metadata_locks      INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS _bak_media_catalog_aliases_084     (LIKE media_catalog_aliases     INCLUDING DEFAULTS);

-- ── videos 重指向快照（回滚需还原 catalog_id 原值；videos.catalog_id ON DELETE SET NULL）──
CREATE TABLE IF NOT EXISTS _bak_videos_catalog_id_084 (
  video_id        UUID        NOT NULL,
  old_catalog_id  UUID,
  new_catalog_id  UUID,
  migration_batch TEXT        NOT NULL DEFAULT '084',
  snapshot_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
