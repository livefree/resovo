-- 094_home_modules_hot_slots.sql
-- 描述：HomeModuleSlot 枚举 4 → 7：新增 hot_movies / hot_series / hot_anime
--       三个热门 shelf pinned 专用 slot（content_ref_type 仅 video）。
--       纯增量扩枚举（旧值全保留），存量行必然满足新 CHECK，ADD 阶段全表校验零阻断。
--       Service 层 applyBusinessRules 内 compat 映射为第 3 处同源规则，与本迁移同卡同步 +3
--       （ADR-181 arch-reviewer BLOCKER 警示）。
-- 日期：2026-06-05
-- ADR：ADR-181（D-181-4，"新增 slot 必须走新 ADR" 的履约文件）
-- 幂等：是（DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT）
--
-- ⚠️  Down 路径说明（项目约定）：
--   scripts/migrate.ts 将整个文件内容作为单条 SQL 执行，不区分 up/down 节。
--   因此 down 路径必须保持注释形式，否则迁移后立即被回滚。
--   需要回滚时，手动解注释 down 节并在目标数据库独立执行（与 049/050 等迁移同约定）。
--   ⚠️ 回滚前提：hot_* slot 存量行数为零（缩枚举 CHECK ADD 阶段会全表校验，
--   存量行非零将直接阻断——ADR-181 follow-up CHG-HOME-BANNER-DECOM 同款技术警告）。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

-- slot 枚举 CHECK（050 建表时为列内联 CHECK，自动命名 home_modules_slot_check）
ALTER TABLE home_modules DROP CONSTRAINT IF EXISTS home_modules_slot_check;
ALTER TABLE home_modules ADD CONSTRAINT home_modules_slot_check
  CHECK (slot IN (
    'banner', 'featured', 'top10', 'type_shortcuts',
    'hot_movies', 'hot_series', 'hot_anime'
  ));

-- content_ref_type × slot 语义约束（ADR-052 + ADR-181 D-181-4：hot_* 仅 video）
ALTER TABLE home_modules DROP CONSTRAINT IF EXISTS home_modules_ref_type_slot_compat;
ALTER TABLE home_modules ADD CONSTRAINT home_modules_ref_type_slot_compat CHECK (
  (slot = 'banner'         AND content_ref_type IN ('video', 'external_url', 'custom_html')) OR
  (slot = 'featured'       AND content_ref_type = 'video') OR
  (slot = 'top10'          AND content_ref_type = 'video') OR
  (slot = 'type_shortcuts' AND content_ref_type = 'video_type') OR
  (slot = 'hot_movies'     AND content_ref_type = 'video') OR
  (slot = 'hot_series'     AND content_ref_type = 'video') OR
  (slot = 'hot_anime'      AND content_ref_type = 'video')
);

COMMENT ON COLUMN home_modules.slot
  IS 'slot 枚举 7 值（ADR-052 原 4 值 + ADR-181 hot_movies/hot_series/hot_anime）；hot_* 为热门 shelf pinned 头部专用，自动候选不落本表（D-181-4.3）';

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- ALTER TABLE home_modules DROP CONSTRAINT IF EXISTS home_modules_slot_check;
-- ALTER TABLE home_modules ADD CONSTRAINT home_modules_slot_check
--   CHECK (slot IN ('banner', 'featured', 'top10', 'type_shortcuts'));
-- ALTER TABLE home_modules DROP CONSTRAINT IF EXISTS home_modules_ref_type_slot_compat;
-- ALTER TABLE home_modules ADD CONSTRAINT home_modules_ref_type_slot_compat CHECK (
--   (slot = 'banner'         AND content_ref_type IN ('video', 'external_url', 'custom_html')) OR
--   (slot = 'featured'       AND content_ref_type = 'video') OR
--   (slot = 'top10'          AND content_ref_type = 'video') OR
--   (slot = 'type_shortcuts' AND content_ref_type = 'video_type')
-- );
-- COMMENT ON COLUMN home_modules.slot
--   IS 'slot 枚举 4 值（ADR-052）';
-- COMMIT;
