-- 057_crawler_sites_user_label.sql
-- 描述：crawler_sites 新增 user_label（面向前端用户的线路别名）
-- 日期：2026-05-01
-- ADR：ADR-109 关联 / M-SN-4 plan v1.4 §2.6
-- 任务卡：CHG-SN-4-03 / SEQ-20260501-01
-- 幂等：是（ADD COLUMN IF NOT EXISTS）
--
-- 新增 1 列：
--   user_label TEXT NULL（面向前端用户；如"主线"/"超清线"/"备用线"）
-- 与既有列分工：
--   key          内部唯一 key（PRIMARY KEY，001 init）
--   name         运维名称（NOT NULL，005 init）
--   display_name admin UI 显示（NULL 允许，038 新增）
--   user_label   前端用户显示（NULL 允许，本 migration 新增）
-- 前端 fallback 链（plan §1 D-11）：user_label ?? display_name ?? key
-- user_label 管理 UI 在 crawler 管理模块（M-SN-6）；本期仅建列，不做编辑入口。
--
-- ⚠️  Down 路径说明（项目约定）：注释形式留存。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE crawler_sites
  ADD COLUMN IF NOT EXISTS user_label TEXT;

COMMENT ON COLUMN crawler_sites.user_label
  IS '面向前端用户的线路别名（如"主线"/"超清线"/"备用线"）；NULL 时降级到 display_name；plan v1.4 §1 D-11 fallback 链';

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- ALTER TABLE crawler_sites DROP COLUMN IF EXISTS user_label;
-- COMMIT;
