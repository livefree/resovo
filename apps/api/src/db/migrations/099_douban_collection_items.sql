-- 099_douban_collection_items.sql
-- ADR-187：豆瓣热门合集资源全面采集 + 落库（subject_collection 数据层）
-- CHG-DOUBAN-HOT-STORE-A / SEQ-20260607-03
--
-- douban_collection_items = 实时热度榜单切片（16 合集：热门/热映/即将上映/Top250/口碑榜/分国别）。
--   全量采集**不按站内映射过滤**（D-187-1）；多 collection 可含同 douban_id（UNIQUE 复合，M2）。
--   raw JSONB = 整条 item 原始 JSON 兜底未来展示（已 strip comments，D-187-1 M1 / INV-2）。
--   rank = 分页拉取全局序位（非评分），随每轮全量替换重算（D-187-1）。
--   与 external_data.douban_entries（14 万静态元数据 dump）并存、零反哺、经 douban_id 关联（D-187-6 INV-3）。
-- douban_collection_sync_state = 合集级新鲜度状态（M3）：消费方据 last_success_at 判陈旧；
--   last_status='empty_guard' = 抓取成功但 items 骤降被守护跳过替换（防 key 失效静默清空，D-187-4）。
--
-- ⚠️  Down 路径说明（项目约定）：scripts/migrate.ts 整文件单条执行，不区分 up/down；
--     down 保持注释，回滚时手动解注释独立执行（与 094–098 同约定）。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS external_data.douban_collection_items (
  id             BIGSERIAL     PRIMARY KEY,
  -- 合集 key（如 movie_hot_gaia / tv_hot / movie_top250）
  collection     TEXT          NOT NULL,
  -- 注册表派生归类（movie|tv|show，D-187-1 权威；item 自带 type 入 raw 不单作权威）
  domain         TEXT          NOT NULL,
  -- 合集类别（trending|ranking|upcoming）
  category       TEXT          NOT NULL,
  douban_id      TEXT          NOT NULL,
  -- 分页拉取全局序位（0 起，非评分；随全量替换重算，消费方不得跨轮缓存）
  rank           INT           NOT NULL,
  title          TEXT          NOT NULL,
  original_title TEXT,
  card_subtitle  TEXT,
  info           TEXT,
  year           INT,
  rating_value   NUMERIC(4,1),
  rating_count   INT,
  cover_url      TEXT,
  uri            TEXT,
  release_date   TEXT,
  -- item 原始 type/subtype（未来细分用；展示以 domain 为准）
  subject_type   TEXT,
  has_linewatch  BOOLEAN       NOT NULL DEFAULT FALSE,
  -- 整条 item 原始 JSON 兜底（已 strip comments，D-187-7 INV-2）
  raw            JSONB         NOT NULL,
  fetched_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 业务唯一：同 douban_id 跨多 collection 合法，复合唯一（M2）
CREATE UNIQUE INDEX IF NOT EXISTS uq_douban_collection_item
  ON external_data.douban_collection_items (collection, douban_id);

-- 合集内按位置展示唯一查询路径（M2）
CREATE INDEX IF NOT EXISTS idx_douban_collection_rank
  ON external_data.douban_collection_items (collection, rank);

-- 与 douban_entries 关联 / 反查「此片属哪些榜」（复合唯一前缀为 collection，纯 douban_id 查询需独立索引，M2）
CREATE INDEX IF NOT EXISTS idx_douban_collection_subject
  ON external_data.douban_collection_items (douban_id);

COMMENT ON TABLE external_data.douban_collection_items
  IS '豆瓣 subject_collection 实时热度榜单切片（ADR-187）；16 合集 trending/ranking/upcoming；不按站内映射过滤全量采集；raw 兜底已 strip comments；与 douban_entries 并存零反哺经 douban_id 关联';

-- ── 合集级新鲜度状态（M3 / D-187-4）─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS external_data.douban_collection_sync_state (
  collection      TEXT          PRIMARY KEY,
  last_attempt_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  -- 'ok' | 'failed' | 'empty_guard'
  last_status     TEXT,
  last_error      TEXT,
  item_count      INT           NOT NULL DEFAULT 0
);

COMMENT ON TABLE external_data.douban_collection_sync_state
  IS '豆瓣合集采集新鲜度状态（ADR-187 D-187-4 / M3）；消费方据 last_success_at 判陈旧；empty_guard=抓取成功但 items 骤降被守护跳过替换（防 key 失效静默清空）';

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- DROP TABLE IF EXISTS external_data.douban_collection_sync_state;
-- DROP TABLE IF EXISTS external_data.douban_collection_items;
-- COMMIT;
