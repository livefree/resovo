-- 063_source_line_aliases.sql
-- 描述：新建 source_line_aliases — 全局线路别名表
--       映射 (source_site_key, source_name) → display_name，供 /admin/sources 线路矩阵渲染
-- 日期：2026-05-12
-- ADR：ADR-114-NEGATED（复合键约束）
-- 任务卡：CHG-SN-5-11 / SEQ-20260501-02
-- 幂等：是（CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS）

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS source_line_aliases (
  source_site_key VARCHAR(100) NOT NULL,
  source_name     TEXT        NOT NULL,
  display_name    TEXT        NOT NULL,
  updated_by      UUID        NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_site_key, source_name)
);

COMMENT ON TABLE source_line_aliases
  IS '全局线路别名表：(source_site_key, source_name) → display_name；CHG-SN-5-11';
COMMENT ON COLUMN source_line_aliases.source_site_key
  IS '站点标识（对应 video_sources.source_site_key / crawler_sites.key）';
COMMENT ON COLUMN source_line_aliases.source_name
  IS '线路名（对应 video_sources.source_name，如"线路1"）';
COMMENT ON COLUMN source_line_aliases.display_name
  IS '面向后台管理员的可读别名（如"哔哩哔哩主线"）';

CREATE INDEX IF NOT EXISTS idx_source_line_aliases_site_key
  ON source_line_aliases (source_site_key);

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- DROP INDEX IF EXISTS idx_source_line_aliases_site_key;
-- DROP TABLE IF EXISTS source_line_aliases;
-- COMMIT;
