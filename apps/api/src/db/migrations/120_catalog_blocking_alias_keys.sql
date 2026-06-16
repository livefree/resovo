-- 120_catalog_blocking_alias_keys.sql
-- 描述：alias_normalized blocking 桶预计算键派生表（ADR-206 D-206-5/6 / ADR-105a AMENDMENT）。
--   承载每 catalog 的「已知名」归一键（normalizeForExternalMatch 投影），供 identity blocking
--   召回（blockingRecall 段③）离线分桶 + 单 video 召回读取——SQL 不可复刻 normalizeForExternalMatch
--   故 TS 单一真源预计算落本表（方案 A 派生表）。
-- 日期：2026-06-16
-- 决策真源：docs/decisions.md ADR-206 §META-50-2A 架构裁决（M-2A-1 派生表 / M-2A-8 migration 范式）
-- 任务卡：META-50-2A-1 / SEQ-20260616-01（WS2，2A 拆 -1/-2 第 1 子卡，纯数据层 + 写键）
-- 子代理：arch-reviewer (claude-opus-4-8, accd3e239e7731ba6) Q1 方案 A 裁决（schema 跨 4 消费方 → 强制 Opus）
-- 幂等：是（CREATE TABLE/INDEX IF NOT EXISTS；可重复执行）
--
-- ⚠️ 事务：由 scripts/migrate.ts 外层 BEGIN/COMMIT 包裹，本文件内不写 BEGIN/COMMIT（105/112/115/119 先例）。
-- ⚠️ Down 路径：注释形式留存（项目约定）。DROP TABLE catalog_blocking_alias_keys;
--
-- M-2A-1：归一键 TS 单一真源 normalizeForExternalMatch（= knownNames.ts dedupKnownNames 同源），
--   SQL 只读不算键；四源（title/title_original/title_en + 别名）统一归一函数，禁复用 title_normalized。
-- M-2A-2：进桶阈值在写键时过滤（catalogBlockingKeys.ts qualifiesForBlockingBucket）——
--   source='catalog' 哨兵 + manual 恒进 / 非 manual 白名单 kind+conf≥0.80 / crawler 排除。
-- PK (catalog_id, normalized_key)：loadKnownNames 已按归一键去重保最强源 → 单 catalog 单键单行；
--   存储该键胜出源的 source/kind/confidence（对齐 1A dedupKnownNames 极性 tiebreak）。
-- 仅扩召回不成正证据（D-206-6a）：本表只供 blocking 召回 + evidence_hash blockingKeys 并集，
--   不进 scorePair 评分（不激活休眠 external_alias_match）。

CREATE TABLE IF NOT EXISTS catalog_blocking_alias_keys (
  catalog_id     UUID    NOT NULL REFERENCES media_catalog(id) ON DELETE CASCADE,
  normalized_key TEXT    NOT NULL,
  source         TEXT    NOT NULL,
  kind           TEXT    NOT NULL,
  confidence     NUMERIC NULL,
  PRIMARY KEY (catalog_id, normalized_key)
);

COMMENT ON TABLE catalog_blocking_alias_keys
  IS 'alias_normalized blocking 桶预计算键（ADR-206 D-206-5/6 / 2A-1）：每 catalog 的 knownNames 投影经 normalizeForExternalMatch 归一后落键，供 blockingRecall 段③离线分桶 + 单 video 召回。SQL 不可复刻归一函数 → TS 单一真源预计算（M-2A-1）。仅扩召回不成正证据（D-206-6a）。';
COMMENT ON COLUMN catalog_blocking_alias_keys.normalized_key
  IS 'normalizeForExternalMatch(已知名) 归一键（与 knownNames.ts dedupKnownNames 同源）。简繁不归一（ADR-175 R1）→ 海贼王/航海王 不同键不误并。';
COMMENT ON COLUMN catalog_blocking_alias_keys.source
  IS '该键胜出源：catalog(哨兵=canonical 标题字段) / manual / tmdb / bangumi / douban（crawler 已在写键时排除）。进桶阈值 M-2A-2 在 catalogBlockingKeys.ts 写键时过滤。';
COMMENT ON COLUMN catalog_blocking_alias_keys.kind
  IS 'KnownName.kind：title(合成主标题) / official / original / localized / aka 等（romanization 仅召回辅助亦可落键）。';
COMMENT ON COLUMN catalog_blocking_alias_keys.confidence
  IS '该键胜出源置信度 [0,1]（catalog/manual 恒为 1.0，NULL=无来源置信）。';

-- 离线分桶主查询：GROUP BY normalized_key（视频经 catalog_id 上卷）→ 同键多 catalog 即候选 pair。
CREATE INDEX IF NOT EXISTS idx_cbak_normalized_key
  ON catalog_blocking_alias_keys (normalized_key);
-- 单 video 取 self 键：走 PK 前缀 (catalog_id, …)，无需额外索引。

-- 验证：表与索引存在（对齐 089 验证块范式）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'catalog_blocking_alias_keys'
  ) THEN
    RAISE EXCEPTION 'migration 120 失败：catalog_blocking_alias_keys 表未创建';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'catalog_blocking_alias_keys' AND indexname = 'idx_cbak_normalized_key'
  ) THEN
    RAISE EXCEPTION 'migration 120 失败：idx_cbak_normalized_key 索引未创建';
  END IF;
END $$;
