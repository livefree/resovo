-- 126_card_size_a2_global.sql
-- ADR-214 Amendment A2（D-214-A2-1/4/5/6）/ SEQ-20260623-02 CARD-SIZE-A2-SCHEMA
--
-- 废弃分档卡宽模型（standard/scroll/compact）→ 单一全局卡宽（全站卡片显示同一尺寸）。
-- card_size_settings 从 standard/scroll 2 行 → 单行全局（size_class='global'，card_width_px=全站统一卡宽 + gap_px）。
--
-- ⚠️ 严格顺序（Codex-A2-R2 BLOCKER）：125 既有约束须先解除，否则改 size_class/删列失败。
-- ⚠️ standard 行 card_width_px 覆盖为 A2 默认 160（A1 未上线、无真实运营数据，覆盖安全；
--    160 在 375 手机屏 ⌊(343+8)/(160+8)⌋=2 列，桌面适中）。
-- ⚠️ Down 路径保持注释（项目约定，同 124/125；migrate.ts 整文件单 SQL 执行）。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

-- (1) 删 125 size_unit_check（含 desktop_columns 引用；不先删则步骤 7 删列失败）
ALTER TABLE card_size_settings DROP CONSTRAINT IF EXISTS card_size_settings_size_unit_check;

-- (2) 删 125 size_class CHECK（旧 IN('standard','scroll') 阻 global）
ALTER TABLE card_size_settings DROP CONSTRAINT IF EXISTS card_size_settings_size_class_check;

-- (3) 删 scroll 行（分档退役）
DELETE FROM card_size_settings WHERE size_class = 'scroll';

-- (4) standard 行 → global + A2 全局默认卡宽 160（保留 id audit 锚点）
UPDATE card_size_settings SET size_class = 'global', card_width_px = 160 WHERE size_class = 'standard';

-- (5) size_class 枚举 CHECK → 单值 global
ALTER TABLE card_size_settings
  ADD CONSTRAINT card_size_settings_size_class_check CHECK (size_class IN ('global'));

-- (6) card_width_px 范围 CHECK [120,400]（125 的 size_unit_check 已删 → 需独立范围 CHECK；card_width_px 列 NOT NULL 保留）
ALTER TABLE card_size_settings
  ADD CONSTRAINT card_size_settings_card_width_px_check CHECK (card_width_px BETWEEN 120 AND 400);

-- (7) 删已废 desktop_columns 列（A2 单一全局卡宽、无列数概念）
ALTER TABLE card_size_settings DROP COLUMN IF EXISTS desktop_columns;

COMMENT ON COLUMN card_size_settings.card_width_px
  IS '全站统一卡片宽度 px [120,400]（ADR-214 Amendment A2：单一全局卡宽，所有网格/横滚区精确定宽消费）';
COMMENT ON TABLE card_size_settings
  IS '前台卡片尺寸体系配置（ADR-214 + Amendment A2）；单行全局（size_class=global，card_width_px=全站统一卡宽 + gap_px）；audit card_size.update target_id 锚点；不可删';

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- ALTER TABLE card_size_settings ADD COLUMN IF NOT EXISTS desktop_columns INT;
-- ALTER TABLE card_size_settings DROP CONSTRAINT IF EXISTS card_size_settings_card_width_px_check;
-- ALTER TABLE card_size_settings DROP CONSTRAINT IF EXISTS card_size_settings_size_class_check;
-- UPDATE card_size_settings SET size_class = 'standard', card_width_px = 200 WHERE size_class = 'global';
-- INSERT INTO card_size_settings (size_class, desktop_columns, card_width_px, gap_px)
--   VALUES ('scroll', NULL, 170, 16) ON CONFLICT (size_class) DO NOTHING;
-- ALTER TABLE card_size_settings
--   ADD CONSTRAINT card_size_settings_size_class_check CHECK (size_class IN ('standard', 'scroll'));
-- ALTER TABLE card_size_settings
--   ADD CONSTRAINT card_size_settings_size_unit_check
--   CHECK (card_width_px BETWEEN 120 AND 400 AND (desktop_columns IS NULL OR desktop_columns BETWEEN 2 AND 8));
-- COMMIT;
