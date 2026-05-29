-- 077_bangumi_metadata.sql
-- ADR-161 / SEQ-BANGUMI-01 / CHG-BNG-01
--
-- Bangumi.tv 接入数据基建：
--   (a) 扩展本地匹配索引表 external_data.bangumi_entries：新增 rank / nsfw
--       （R1 修订：不新增 total_episodes，复用 036 既有 episode_count；
--        由 import-bangumi-dump.ts 回填 dump 的 eps/total_episodes 到 episode_count）
--   (b) 新建 catalog_episodes 逐集元数据表（按 catalog_id + source 设计，便于将来扩源）
--
-- 幂等：IF NOT EXISTS / ADD COLUMN IF NOT EXISTS，可重复执行

BEGIN;

-- ── (a) external_data.bangumi_entries 扩列 ──────────────────────────
ALTER TABLE external_data.bangumi_entries
  ADD COLUMN IF NOT EXISTS rank INT,
  ADD COLUMN IF NOT EXISTS nsfw BOOLEAN NOT NULL DEFAULT false;

-- seed 反向建库按 rank/year 过滤
CREATE INDEX IF NOT EXISTS idx_external_bangumi_rank
  ON external_data.bangumi_entries (rank);

-- ── (b) catalog_episodes 逐集元数据表 ───────────────────────────────
CREATE TABLE IF NOT EXISTS catalog_episodes (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id          UUID        NOT NULL REFERENCES media_catalog(id) ON DELETE CASCADE,
  source              TEXT        NOT NULL DEFAULT 'bangumi',
  external_episode_id TEXT,
  ep_type             SMALLINT    NOT NULL DEFAULT 0,   -- 0 本篇 / 1 SP / 2 OP / 3 ED
  sort                NUMERIC,
  ep                  INT,
  name                TEXT,
  name_cn             TEXT,
  airdate             DATE,
  duration_seconds    INT,
  description         TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_episodes_src_ext
  ON catalog_episodes (catalog_id, source, external_episode_id);
CREATE INDEX IF NOT EXISTS idx_catalog_episodes_catalog_type_sort
  ON catalog_episodes (catalog_id, ep_type, sort);

-- ── 验证 ────────────────────────────────────────────────────────────
DO $$
DECLARE
  b_cols INT;
  e_cols INT;
BEGIN
  SELECT COUNT(*) INTO b_cols
  FROM information_schema.columns
  WHERE table_schema = 'external_data' AND table_name = 'bangumi_entries'
    AND column_name IN ('rank', 'nsfw');

  SELECT COUNT(*) INTO e_cols
  FROM information_schema.columns
  WHERE table_name = 'catalog_episodes'
    AND column_name IN ('catalog_id', 'source', 'external_episode_id', 'ep_type', 'sort', 'airdate');

  IF b_cols < 2 THEN
    RAISE EXCEPTION 'Migration 077: bangumi_entries 扩列缺失，期望 2，实际 %', b_cols;
  END IF;

  IF e_cols < 6 THEN
    RAISE EXCEPTION 'Migration 077: catalog_episodes 字段缺失，期望 6，实际 %', e_cols;
  END IF;

  RAISE NOTICE 'Migration 077 OK: bangumi_entries 扩 rank/nsfw + catalog_episodes 已创建';
END $$;

COMMIT;
