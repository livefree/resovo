-- 040_douban_people.sql
-- META-02: 新建 external_data.douban_people
-- 来源：external-db/douban/moviedata-10m/person.csv（约 7.3 万行）
-- 用途：供 META-04/05 人物精确匹配（actor_ids/director_ids → person_id → 人物详情）
-- 幂等：可重复执行

BEGIN;

CREATE TABLE IF NOT EXISTS external_data.douban_people (
  id            BIGSERIAL   PRIMARY KEY,
  person_id     TEXT        NOT NULL,          -- 豆瓣人物 ID
  name          TEXT        NOT NULL,          -- 中文名
  name_en       TEXT,                          -- 英文名（含"本名/昵称"标注，原文保留）
  name_zh       TEXT,                          -- 中文别名（含标注，原文保留）
  sex           TEXT,                          -- 性别（男/女/...）
  birth         TEXT,                          -- 出生日期（TEXT，格式 YYYY-MM-DD 或空）
  birthplace    TEXT,                          -- 出生地
  constellation TEXT,                          -- 星座
  profession    TEXT[]      NOT NULL DEFAULT '{}', -- 职业列表（演员/导演/编剧 等）
  biography     TEXT,                          -- 简介
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_external_douban_people_person_id
  ON external_data.douban_people (person_id);

-- 中文名查找索引（MetadataEnrichService / 后台搜索用）
CREATE INDEX IF NOT EXISTS idx_external_douban_people_name
  ON external_data.douban_people (name);

-- ── 验证 ──────────────────────────────────────────────────────────────

DO $$
DECLARE
  col_count INT;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_schema = 'external_data' AND table_name = 'douban_people'
    AND column_name IN ('person_id', 'name', 'name_en', 'profession', 'biography');

  IF col_count < 5 THEN
    RAISE EXCEPTION 'Migration 040: external_data.douban_people 字段缺失，期望 5，实际 %', col_count;
  END IF;

  RAISE NOTICE 'Migration 040 OK: external_data.douban_people 已创建';
END $$;

COMMIT;
