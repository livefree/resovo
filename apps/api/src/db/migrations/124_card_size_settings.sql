-- 124_card_size_settings.sql
-- ADR-214 D-214-3（card_size_settings 表 + seed 3 行）+ audit target_kind 17→18（+card_size）
-- ADR-215（admin-route + 公开 route 端点契约底座）/ SEQ-20260622-03 Phase 1 CARD-SIZE-DB
--
-- DB 驱动、后台可配的前台卡片尺寸体系数据底座：3 档尺寸模型（standard/compact/scroll，混合单位）。
-- 复用 home_section_settings（095）配置表范式：id UUID PK（audit target_id 锚点）+ 业务键 UNIQUE
-- + seed 恒存在 + updated_at 触发器 + audit target_kind DROP/ADD CONSTRAINT 扩展。
--
-- ⚠️  Down 路径说明（项目约定，同 095/097）：
--   scripts/migrate.ts 将整个文件内容作为单条 SQL 执行，不区分 up/down 节。
--   down 路径必须保持注释形式；需要回滚时手动解注释独立执行。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS card_size_settings (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),   -- audit target_id 锚点（targetId=row.id，仿 home_section D-182-5.3）
  -- CardSizeClass 封闭枚举 3 值（ADR-214 D-214-2；新增/退役档位走 ADR-214 amendment + migration）
  size_class      TEXT         NOT NULL UNIQUE
                                 CHECK (size_class IN ('standard', 'compact', 'scroll')),
  -- 网格档（standard/compact）列数；scroll 档 NULL（D-214-4：网格存列数不存卡宽，弹性列由容器派生）
  desktop_columns INT          NULL CHECK (desktop_columns BETWEEN 2 AND 8),
  -- scroll 档横滚卡定宽 px；网格档 NULL（横滚无列概念、本就固定宽度）
  card_width_px   INT          NULL CHECK (card_width_px BETWEEN 120 AND 280),
  gap_px          INT          NOT NULL CHECK (gap_px BETWEEN 0 AND 64),
  -- 非关键扩展项（样式/文案 override）；禁关键策略字段（ADR-052/182 metadata 守则同款）
  settings        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- 档位×单位绑定 CHECK（Codex-R1 HIGH，D-214-3）：单位绑定到具体 size_class（非仅"二选一"）
  -- → 网格档（standard/compact）必列数非空·卡宽空；scroll 档必卡宽非空·列数空。
  -- 拒绝语义倒置行（scroll+columns / 网格档+width）：DB 单真源下，直写/坏 seed/未来 migration 造倒置行，
  -- 公开 API/SSR 会信任它产出错/缺 CSS 变量。倒置行测见 tests/integration/api/card-size-settings-schema.test.ts。
  CONSTRAINT card_size_settings_unit_by_class_check CHECK (
    (size_class IN ('standard', 'compact') AND desktop_columns IS NOT NULL AND card_width_px IS NULL)
    OR
    (size_class = 'scroll' AND desktop_columns IS NULL AND card_width_px IS NOT NULL)
  )
);

CREATE OR REPLACE FUNCTION card_size_settings_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS card_size_settings_set_updated_at_trg ON card_size_settings;
CREATE TRIGGER card_size_settings_set_updated_at_trg
  BEFORE UPDATE ON card_size_settings
  FOR EACH ROW EXECUTE FUNCTION card_size_settings_set_updated_at();

-- seed 3 行（ADR-214 D-214-3 默认值，SQL 字面量——migration 纯 SQL 不能 import TS 常量；
-- 与 CARD_SIZE_DEFAULTS〔@resovo/types〕由一致性单测守同步〔D-214-5〕；运营可改不写死；ON CONFLICT 幂等）
INSERT INTO card_size_settings (size_class, desktop_columns, card_width_px, gap_px) VALUES
  ('standard', 5,    NULL, 16),
  ('compact',  3,    NULL, 12),
  ('scroll',   NULL, 170,  16)
ON CONFLICT (size_class) DO NOTHING;

-- audit target_kind CHECK 17 → 18：+card_size（ADR-214 D-214-3；088/095/097 同范式。
-- action_type 列无 DB CHECK——D-182-5.2 既有裁定，card_size.update 仅 TS 枚举，由 CARD-SIZE-SERVICE-ADMIN 落地）
ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_target_kind_check;
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_target_kind_check
  CHECK (target_kind IN (
    'video', 'video_source', 'staging', 'review_label', 'crawler_site', 'system',
    'home_module', 'source_line_alias', 'source_route', 'user_submission', 'image_health',
    'user', 'filter_preset', 'crawler_task', 'identity_candidate', 'home_section',
    'home_page', 'card_size'
  ));

COMMENT ON COLUMN admin_audit_log.target_kind
  IS 'CHECK 限定 18 种（ADR-214 扩展 card_size；17→18）';

COMMENT ON TABLE card_size_settings
  IS '前台卡片尺寸体系配置（ADR-214 D-214-3）；seed 3 行恒存在（standard/compact/scroll），audit card_size.update 的 target_id 锚点；不可删（无 DELETE 端点），档位新增/退役走 ADR-214 amendment + migration';

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_target_kind_check;
-- ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_target_kind_check
--   CHECK (target_kind IN (
--     'video', 'video_source', 'staging', 'review_label', 'crawler_site', 'system',
--     'home_module', 'source_line_alias', 'source_route', 'user_submission', 'image_health',
--     'user', 'filter_preset', 'crawler_task', 'identity_candidate', 'home_section',
--     'home_page'
--   ));
-- DROP TRIGGER IF EXISTS card_size_settings_set_updated_at_trg ON card_size_settings;
-- DROP FUNCTION IF EXISTS card_size_settings_set_updated_at();
-- DROP TABLE IF EXISTS card_size_settings;
-- COMMIT;
