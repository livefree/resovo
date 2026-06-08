-- 101_bangumi_collection_items.sql
-- ADR-189 D-189-3 / SEQ-20260607-05 / CHG-BNG-RES-STORE-2A
--
-- Bangumi 派生「热门/排行/每日放送」落库切片（Bangumi 无原生合集端点）：
--   trending = POST /v0/search/subjects sort=heat（+当季 air_date filter）
--   ranking  = POST /v0/search/subjects sort=rank（高分榜）
--   calendar = GET /calendar（每日放送，7 weekday 各一 collection key bgm_calendar_mon..sun）
-- 落库范式对齐 099 douban_collection_items（全量替换 + sync_state empty_guard），但：
--   - 字段集 bangumi 专属（分表非并表，ADR-189 D-189-3 / arch H2：两 provider 字段差异 >50%）
--   - air_weekday 仅 calendar 非空（CHECK 自洽，arch H2）
--   - calendar「一拉七写」原子（7 weekday 共享一次 GET /calendar，整体失败全不替换，D-189-2）
--
-- 幂等：IF NOT EXISTS，可重复执行。
-- ⚠️  Down 路径：scripts/migrate.ts 整文件单条执行不分 up/down；down 保持注释，回滚手动解注释（同 099 约定）。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS external_data.bangumi_collection_items (
  id           BIGSERIAL    PRIMARY KEY,
  -- 合集 key（bgm_trending | bgm_ranking | bgm_calendar_mon..sun）
  collection   TEXT         NOT NULL,
  -- 合集类别（trending | ranking | calendar）
  category     TEXT         NOT NULL,
  bangumi_id   TEXT         NOT NULL,
  -- 榜单/分页序位（0 起，非评分；随全量替换重算，消费方不得跨轮缓存）
  rank         INT          NOT NULL,
  -- 主显示名（name_cn 回退 name）
  title        TEXT         NOT NULL,
  -- 中文名（bangumi name_cn，可空）
  name_cn      TEXT,
  year         INT,
  rating       NUMERIC(4,1),
  -- 放送星期（1=周一..7=周日），仅 calendar 非空
  air_weekday  SMALLINT,
  cover_url    TEXT,
  -- 整条原始 item JSON 兜底（审计/未来字段回填）
  raw          JSONB        NOT NULL,
  fetched_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- air_weekday 稀疏列语义自洽：仅 calendar 行可非空
  CONSTRAINT chk_bangumi_collection_air_weekday CHECK (category = 'calendar' OR air_weekday IS NULL)
);

-- 业务唯一：同 bangumi_id 跨多 collection 合法，复合唯一
CREATE UNIQUE INDEX IF NOT EXISTS uq_bangumi_collection_item
  ON external_data.bangumi_collection_items (collection, bangumi_id);

-- 合集内按位置展示
CREATE INDEX IF NOT EXISTS idx_bangumi_collection_rank
  ON external_data.bangumi_collection_items (collection, rank);

-- 反查「此作品属哪些榜」/ 与 bangumi_entries 关联（复合唯一前缀为 collection，纯 bangumi_id 查询需独立索引）
CREATE INDEX IF NOT EXISTS idx_bangumi_collection_subject
  ON external_data.bangumi_collection_items (bangumi_id);

COMMENT ON TABLE external_data.bangumi_collection_items
  IS 'Bangumi 派生热门/排行/每日放送切片（ADR-189）；search sort=heat/rank + GET /calendar 派生；分表非并表；air_weekday 仅 calendar 非空；calendar 一拉七写原子';

-- ── 合集级新鲜度状态（对齐 099 douban_collection_sync_state）──────────────────────

CREATE TABLE IF NOT EXISTS external_data.bangumi_collection_sync_state (
  collection      TEXT          PRIMARY KEY,
  last_attempt_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  -- 'ok' | 'failed' | 'empty_guard'
  last_status     TEXT,
  last_error      TEXT,
  item_count      INT           NOT NULL DEFAULT 0
);

COMMENT ON TABLE external_data.bangumi_collection_sync_state
  IS 'Bangumi 合集采集新鲜度状态（ADR-189 D-189-3）；trending/ranking per-collection 骤降守护；calendar 守护落 7 天总量基线（D-189-2）';

-- ── 验证（对齐 099 DO 块范式）────────────────────────────────────────────────────
DO $$
DECLARE
  i_cols INT;
  s_cols INT;
BEGIN
  SELECT COUNT(*) INTO i_cols
  FROM information_schema.columns
  WHERE table_schema = 'external_data' AND table_name = 'bangumi_collection_items'
    AND column_name IN ('collection', 'category', 'bangumi_id', 'rank', 'title', 'air_weekday', 'raw');

  SELECT COUNT(*) INTO s_cols
  FROM information_schema.columns
  WHERE table_schema = 'external_data' AND table_name = 'bangumi_collection_sync_state'
    AND column_name IN ('collection', 'last_attempt_at', 'last_success_at', 'last_status', 'item_count');

  IF i_cols < 7 THEN
    RAISE EXCEPTION 'Migration 101: bangumi_collection_items 字段缺失，期望 7，实际 %', i_cols;
  END IF;
  IF s_cols < 5 THEN
    RAISE EXCEPTION 'Migration 101: bangumi_collection_sync_state 字段缺失，期望 5，实际 %', s_cols;
  END IF;

  RAISE NOTICE 'Migration 101 OK: bangumi_collection_items + bangumi_collection_sync_state 已创建';
END $$;

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- DROP TABLE IF EXISTS external_data.bangumi_collection_sync_state;
-- DROP TABLE IF EXISTS external_data.bangumi_collection_items;
-- COMMIT;
