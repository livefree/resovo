-- 083_bangumi_characters.sql
-- ADR-161 AMENDMENT 2026-05-30（CHG-BNG-CHAR / META-19）— 角色↔CV 入库
--
-- Bangumi 角色 + 声优(CV) 自动入库：媒体作品的角色阵容与配音演员（N:M）。
--   catalog_characters         角色（按 catalog_id + source 归属，对齐 077 catalog_episodes 范式）
--   catalog_character_actors   角色下的 CV（声优，N 个；归属于角色行，随角色 CASCADE）
--
-- 来源：Bangumi GET /v0/subjects/{id}/characters（无分页，一次返回全部角色 + 各自 actors[]）。
-- 写入策略：BangumiService delete-by-catalog-then-insert（事务内 / 仅 REST 命中非降级时），
--           角色集合 = 源端集合（可删除源端已不存在的孤儿角色，区别于逐集 upsert）。
-- 幂等：IF NOT EXISTS，可重复执行。

BEGIN;

CREATE TABLE IF NOT EXISTS catalog_characters (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id            UUID        NOT NULL REFERENCES media_catalog(id) ON DELETE CASCADE,
  source                TEXT        NOT NULL DEFAULT 'bangumi',
  external_character_id TEXT        NOT NULL,
  name                  TEXT        NOT NULL,
  relation              TEXT,        -- 主角 / 配角 / 客串 / 闲角（原文存，不枚举化，源端扩值不破坏）
  char_type             SMALLINT,    -- Bangumi type：1 角色 / 2 机体 / 3 舰船 / 4 组织
  sort                  INT         NOT NULL DEFAULT 0,  -- 展示顺序（relation 权重 + 原序填充）
  image_url             TEXT,
  summary               TEXT,        -- 角色简介（长文本；展示层截断）
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_characters_src_ext
  ON catalog_characters (catalog_id, source, external_character_id);
CREATE INDEX IF NOT EXISTS idx_catalog_characters_catalog_sort
  ON catalog_characters (catalog_id, sort);

CREATE TABLE IF NOT EXISTS catalog_character_actors (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id      UUID        NOT NULL REFERENCES catalog_characters(id) ON DELETE CASCADE,
  external_actor_id TEXT        NOT NULL,   -- Bangumi person id
  name              TEXT        NOT NULL,
  image_url         TEXT,
  sort              INT         NOT NULL DEFAULT 0,  -- 同角色下多 CV 顺序（源数组序）
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_character_actors_char_ext
  ON catalog_character_actors (character_id, external_actor_id);
CREATE INDEX IF NOT EXISTS idx_catalog_character_actors_char_sort
  ON catalog_character_actors (character_id, sort);

-- ── 验证（对齐 077 DO 块范式）────────────────────────────────────────
DO $$
DECLARE
  c_cols INT;
  a_cols INT;
BEGIN
  SELECT COUNT(*) INTO c_cols
  FROM information_schema.columns
  WHERE table_name = 'catalog_characters'
    AND column_name IN ('catalog_id', 'source', 'external_character_id', 'relation', 'sort', 'summary');

  SELECT COUNT(*) INTO a_cols
  FROM information_schema.columns
  WHERE table_name = 'catalog_character_actors'
    AND column_name IN ('character_id', 'external_actor_id', 'name', 'sort');

  IF c_cols < 6 THEN
    RAISE EXCEPTION 'Migration 083: catalog_characters 字段缺失，期望 6，实际 %', c_cols;
  END IF;
  IF a_cols < 4 THEN
    RAISE EXCEPTION 'Migration 083: catalog_character_actors 字段缺失，期望 4，实际 %', a_cols;
  END IF;

  RAISE NOTICE 'Migration 083 OK: catalog_characters + catalog_character_actors 已创建';
END $$;

COMMIT;
