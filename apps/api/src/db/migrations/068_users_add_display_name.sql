-- 068_users_add_display_name.sql
-- ADR-140 / CHG-SN-8-FUP-USERS-EDIT-EP
--
-- users 表新增 display_name 列：admin 可编辑的用户展示名（与登录用户名 username 区分）
--   NULL = 该用户从未设置 display_name；前端展示降级到 username
--   非空 = admin 通过 PATCH /admin/users/:id/profile 设置
--
-- 详见 ADR-140 §D-140-3（displayName 校验规则）+ §5 Migration A + §10 R-140-3（回退路径）

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE users ADD COLUMN display_name VARCHAR(50) DEFAULT NULL;
  END IF;
END
$$;

COMMENT ON COLUMN users.display_name
  IS '用户展示名（可选，1-50 字符）；NULL 时前端降级到 username；admin 可编辑（ADR-140）';
