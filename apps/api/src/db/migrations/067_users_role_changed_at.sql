-- 067_users_role_changed_at.sql
-- ADR-139 / CHG-SN-8-FUP-USERS-ROLE-INV-EP
--
-- users 表新增 role_changed_at 列：admin 变更该用户角色的最后时间戳
--   NULL = 该用户角色从未被改过；middleware 视为放行
--   非空 = middleware 比对 access token iat 决定是否拒绝（401 ROLE_CHANGED）
--
-- 详见 ADR-139 §D-139-1（方案 B 选型）+ §D-139-5（schema 变更）+ §10 R-139-4（回退路径）

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'role_changed_at'
  ) THEN
    ALTER TABLE users ADD COLUMN role_changed_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END
$$;

COMMENT ON COLUMN users.role_changed_at
  IS 'admin 变更该用户角色的最后时间戳（ADR-139）；NULL = 从未被改过；middleware 比对 access token iat 决定是否拒绝';
