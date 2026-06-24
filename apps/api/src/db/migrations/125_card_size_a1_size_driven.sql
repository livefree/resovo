-- 125_card_size_a1_size_driven.sql
-- ADR-214 Amendment A1（D-214-A1-3/4/5）/ SEQ-20260623-01 CARD-SIZE-A1-SCHEMA
--
-- standard 网格由「设列数」翻转为「设卡宽 px（size-driven）」+ 废弃零消费 compact 档。
-- 修订 migration 124 的 card_size_settings：
--   - card_width_px：仅 scroll 非空 [120,280] → 全档 NOT NULL [120,400]（standard 卡可宽于 scroll 170）
--   - desktop_columns：网格档 NOT NULL → 全档 NULLABLE（退化为可选最大列数护栏，本轮 standard seed=NULL）
--   - size_class 枚举：删 'compact'（IN ('standard','scroll')，D-214-A1-3 / Codex-A1-R2）
--   - 删档位×单位绑定 CHECK（单位统一为卡宽后失去前提）→ 新 size_unit_check（全档卡宽非空 + 列数护栏）
--   - seed 演进：standard (5,NULL,16)→(NULL,200,16)、DELETE compact、scroll (NULL,170,16) 不变
--
-- ⚠️ 步骤顺序关键（Codex-A1-R3 BLOCKER）：standard 现有行 card_width_px=NULL，
--    必须先回填（步骤 2）再 SET NOT NULL（步骤 6），否则约束添加失败。
-- ⚠️ 约束名按 Postgres 内联列 CHECK 标准命名 `<table>_<column>_check`（124 每列单 CHECK，名确定）；
--    全程 DROP ... IF EXISTS 幂等（同 124/095 约定）。
-- ⚠️ Down 路径：migrate.ts 将整文件作为单条 SQL 执行、不区分 up/down 节；down 保持注释（同 124），
--    需回滚时手动解注释独立执行。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

-- (1) 删旧档位×单位绑定 CHECK（单位统一为卡宽后失去前提：拒「scroll 带 columns / 网格档带 width」已不适用）
--     先删以解除「网格档 card_width_px 必空」约束，否则步骤 2 回填 standard 卡宽会被拒。
ALTER TABLE card_size_settings
  DROP CONSTRAINT IF EXISTS card_size_settings_unit_by_class_check;

-- (2) 回填 standard 卡宽（NOT NULL 前置，Codex-A1-R3）：列数语义 → 卡宽 px（D-214-A1-1），
--     desktop_columns 退为 NULL（D-214-A1-4：本轮不启用列数护栏，列数由容器宽派生）
UPDATE card_size_settings
   SET card_width_px = 200, desktop_columns = NULL
 WHERE size_class = 'standard';

-- (3) 删除零消费 compact 档（D-214-A1-3：详情侧栏已硬编码 60px 列表、FEATURED-NORMALIZE 删 grid 死分支，幽灵配置）
DELETE FROM card_size_settings WHERE size_class = 'compact';

-- (4) 重写 size_class 枚举 CHECK：删 'compact'（仅 DELETE 行不够——CHECK 仍含 compact 则未来可再插入幽灵行，Codex-A1-R2）
ALTER TABLE card_size_settings
  DROP CONSTRAINT IF EXISTS card_size_settings_size_class_check;
ALTER TABLE card_size_settings
  ADD CONSTRAINT card_size_settings_size_class_check
  CHECK (size_class IN ('standard', 'scroll'));

-- (5) 放宽卡宽范围 [120,280]→[120,400] + 列数护栏并入统一 size_unit_check（删 124 两条内联匿名列 CHECK）
ALTER TABLE card_size_settings
  DROP CONSTRAINT IF EXISTS card_size_settings_card_width_px_check;
ALTER TABLE card_size_settings
  DROP CONSTRAINT IF EXISTS card_size_settings_desktop_columns_check;
ALTER TABLE card_size_settings
  ADD CONSTRAINT card_size_settings_size_unit_check
  CHECK (
    card_width_px BETWEEN 120 AND 400
    AND (desktop_columns IS NULL OR desktop_columns BETWEEN 2 AND 8)
  );

-- (6) card_width_px 全档非空（此时 standard 已回填 200、compact 已删、scroll 本就非空——SET NOT NULL 必成功）
ALTER TABLE card_size_settings
  ALTER COLUMN card_width_px SET NOT NULL;

COMMENT ON COLUMN card_size_settings.card_width_px
  IS '卡片宽度 px [120,400]，全档非空（ADR-214 Amendment A1：standard size-driven 设卡宽 / scroll 横滚定宽）';
COMMENT ON COLUMN card_size_settings.desktop_columns
  IS '可选最大列数护栏 [2,8]，全档 NULLABLE（ADR-214 Amendment A1：本轮 standard=NULL，列数由容器宽派生）';
COMMENT ON TABLE card_size_settings
  IS '前台卡片尺寸体系配置（ADR-214 + Amendment A1）；seed 2 档恒存在（standard 网格 size-driven / scroll 横滚，均存卡宽 px），audit card_size.update 的 target_id 锚点；不可删，档位新增/退役走 ADR-214 amendment + migration';

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- ALTER TABLE card_size_settings ALTER COLUMN card_width_px DROP NOT NULL;
-- ALTER TABLE card_size_settings DROP CONSTRAINT IF EXISTS card_size_settings_size_unit_check;
-- ALTER TABLE card_size_settings ADD CONSTRAINT card_size_settings_card_width_px_check CHECK (card_width_px BETWEEN 120 AND 280);
-- ALTER TABLE card_size_settings ADD CONSTRAINT card_size_settings_desktop_columns_check CHECK (desktop_columns BETWEEN 2 AND 8);
-- ALTER TABLE card_size_settings DROP CONSTRAINT IF EXISTS card_size_settings_size_class_check;
-- ALTER TABLE card_size_settings ADD CONSTRAINT card_size_settings_size_class_check CHECK (size_class IN ('standard', 'compact', 'scroll'));
-- UPDATE card_size_settings SET desktop_columns = 5, card_width_px = NULL WHERE size_class = 'standard';
-- INSERT INTO card_size_settings (size_class, desktop_columns, card_width_px, gap_px) VALUES ('compact', 3, NULL, 12) ON CONFLICT (size_class) DO NOTHING;
-- ALTER TABLE card_size_settings ADD CONSTRAINT card_size_settings_unit_by_class_check CHECK (
--   (size_class IN ('standard', 'compact') AND desktop_columns IS NOT NULL AND card_width_px IS NULL)
--   OR (size_class = 'scroll' AND desktop_columns IS NULL AND card_width_px IS NOT NULL)
-- );
-- COMMIT;
