-- 080_users_preferences.sql
-- 描述：users 表加 preferences JSONB 字段（ADR-165 ROUTE-LABEL-D 跨设备主题同步）
-- 日期：2026-05-28
-- 幂等：是（IF NOT EXISTS）
-- ADR: ADR-165 §4 SQL 草案 / R-165-5 与 Migration 077 inline CHECK 范式对齐
--
-- 索引设计 4 步核验（db-rules.md §"索引设计 4 步核验"）：
--   1. 索引键：N/A（不加索引 / 应用层按 users.id PK 命中 / 单行 lookup）
--   2. 部分索引 WHERE：N/A
--   3. 候选 driving 谓词：GET/PUT /users/me/preferences 走 `WHERE id = $1` PK / 已有 users_pkey
--   4. 匹配判定：PK 完整覆盖 / 不需新索引（实测留 EXPLAIN ANALYZE）

-- R-165-5 修订：inline ADD COLUMN ... CHECK（与 Migration 077 meta_quality 范式对齐 / 简洁幂等）
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(preferences) = 'object');

-- DO 块验证：列存在
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'preferences'
  ) THEN
    RAISE EXCEPTION 'Migration 080 failed: users.preferences column not created';
  END IF;
END$$;

-- ROLLBACK SQL（向后兼容性 / 应用层降级到 localStorage / 与 CHG-369-B 双 key localStorage 共存）：
-- ALTER TABLE users DROP COLUMN IF EXISTS preferences;
-- （CHECK 约束随列一起删除 / 不需独立 DROP）
