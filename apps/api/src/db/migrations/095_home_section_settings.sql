-- 095_home_section_settings.sql
-- ADR-182 D-182-3（home_section_settings 表 + seed）+ D-182-5（audit target_kind 15→16）
-- CHG-HOME-PREVIEW-API-A / SEQ-20260605-05
--
-- Home Curation 区块设置：autofill 模式 / 重算频率 / 槽位数等关键策略字段列化
-- （ADR-052 metadata 守则：需 WHERE 过滤的字段禁入 JSONB）；杂项进 settings JSONB。
-- seed 7 行保证每 section 恒有一行 → audit target_id 锚点恒存在（D-182-5.3）。
-- 编号协调：本迁移假定 094（CHG-HOME-SLOT-EXTEND）已占用 ✅（D-182-3）。
--
-- ⚠️  Down 路径说明（项目约定）：
--   scripts/migrate.ts 将整个文件内容作为单条 SQL 执行，不区分 up/down 节。
--   down 路径必须保持注释形式；需要回滚时手动解注释独立执行（与 049/050/094 同约定）。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS home_section_settings (
  id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- HomeSectionKey 7 值（D-182-2；section ≠ slot——banner section 真源是 home_banners）。
  -- 同源 CHECK 第 2 处在未来 096 快照表（ADR-183），扩值必须同卡同步两表。
  section                   TEXT         NOT NULL UNIQUE
                                           CHECK (section IN (
                                             'banner', 'type_shortcuts', 'featured', 'top10',
                                             'hot_movies', 'hot_series', 'hot_anime'
                                           )),
  autofill_mode             TEXT         NOT NULL
                                           CHECK (autofill_mode IN (
                                             'manual_only', 'manual_plus_autofill', 'suggest_only', 'full_auto'
                                           )),
  -- NULL = 不自动重算；worker 调度消费（ADR-183 D-183-3.2）
  refresh_interval_minutes  INT          NULL CHECK (refresh_interval_minutes > 0),
  -- 区块槽位数；空卡片占位 = max(0, display_count − pinned − auto)（D-182-3）
  display_count             INT          NOT NULL CHECK (display_count > 0),
  -- 跨区块去重豁免（方案 §7.1）
  allow_duplicates          BOOLEAN      NOT NULL DEFAULT false,
  -- full_auto 区块 pinned 头部上限；NULL = 不限
  pinned_limit              INT          NULL CHECK (pinned_limit > 0),
  -- 非关键扩展项（样式/文案 override）；禁关键策略字段（ADR-052 metadata 守则同款）
  settings                  JSONB        NOT NULL DEFAULT '{}'::jsonb,
  updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION home_section_settings_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS home_section_settings_set_updated_at_trg ON home_section_settings;
CREATE TRIGGER home_section_settings_set_updated_at_trg
  BEFORE UPDATE ON home_section_settings
  FOR EACH ROW EXECUTE FUNCTION home_section_settings_set_updated_at();

-- seed 7 行（ADR-182 D-182-3 默认值；运营可改不写死；ON CONFLICT 幂等）
INSERT INTO home_section_settings (section, autofill_mode, refresh_interval_minutes, display_count) VALUES
  ('banner',         'suggest_only',         1440, 5),
  ('type_shortcuts', 'manual_only',          NULL, 6),
  ('featured',       'manual_plus_autofill', 60,   4),
  ('top10',          'manual_plus_autofill', 60,   10),
  ('hot_movies',     'full_auto',            1440, 10),
  ('hot_series',     'full_auto',            1440, 10),
  ('hot_anime',      'full_auto',            1440, 10)
ON CONFLICT (section) DO NOTHING;

-- audit target_kind CHECK 15 → 16：+home_section（ADR-182 D-182-5；088 同范式）
ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_target_kind_check;
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_target_kind_check
  CHECK (target_kind IN (
    'video', 'video_source', 'staging', 'review_label', 'crawler_site', 'system',
    'home_module', 'source_line_alias', 'source_route', 'user_submission', 'image_health',
    'user', 'filter_preset', 'crawler_task', 'identity_candidate', 'home_section'
  ));

COMMENT ON COLUMN admin_audit_log.target_kind
  IS 'CHECK 限定 16 种（ADR-182 扩展 home_section；15→16）';

COMMENT ON TABLE home_section_settings
  IS 'Home Curation 区块设置（ADR-182 D-182-3）；seed 7 行恒存在，audit target_id 锚点；不可删（无 DELETE 端点），section 退役走 ADR + migration';

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_target_kind_check;
-- ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_target_kind_check
--   CHECK (target_kind IN (
--     'video', 'video_source', 'staging', 'review_label', 'crawler_site', 'system',
--     'home_module', 'source_line_alias', 'source_route', 'user_submission', 'image_health',
--     'user', 'filter_preset', 'crawler_task', 'identity_candidate'
--   ));
-- DROP TRIGGER IF EXISTS home_section_settings_set_updated_at_trg ON home_section_settings;
-- DROP FUNCTION IF EXISTS home_section_settings_set_updated_at();
-- DROP TABLE IF EXISTS home_section_settings;
-- COMMIT;
