-- 071_user_filter_presets.sql
-- ADR-144 / CHG-SN-8-FUP-PRESET-TEAM-EP-A
--
-- FilterPreset 持久化表：从前端 localStorage 升级到 DB 存储
-- scope 模型：private（仅创建者可见）/ shared（全 moderator+admin 可见）
-- 不引入 team 概念（Resovo 当前架构无多租户；后续可加 team_id 列扩展）

BEGIN;

CREATE TABLE IF NOT EXISTS user_filter_presets (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id   UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT         NOT NULL,
  scope           TEXT         NOT NULL DEFAULT 'private'
                                CHECK (scope IN ('private', 'shared')),
  tab             TEXT         NOT NULL
                                CHECK (tab IN ('pending', 'staging', 'rejected', 'all')),
  query_jsonb     JSONB        NOT NULL DEFAULT '{}',
  is_default      BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_filter_presets
  IS 'FilterPreset 持久化（ADR-144）；scope=private 仅 owner / scope=shared 全 moderator+admin 可见';
COMMENT ON COLUMN user_filter_presets.owner_user_id
  IS '创建者 user id；CASCADE 删除（预设非审计数据，用户删除时自然清理）';
COMMENT ON COLUMN user_filter_presets.scope
  IS 'private=仅 owner / shared=团队共享；CHECK 约束限定 2 值';
COMMENT ON COLUMN user_filter_presets.tab
  IS '预设绑定的审核 tab；CHECK 限定 4 值（与前端 FilterPresetTab 对齐）';
COMMENT ON COLUMN user_filter_presets.query_jsonb
  IS '筛选条件 JSONB 快照（type / sourceCheckStatus / doubanStatus / hasStaffNote / needsManualReview）';
COMMENT ON COLUMN user_filter_presets.is_default
  IS '同 owner+tab 最多 1 个 default（部分唯一索引 idx_ufp_default_unique 保证）';

-- 主查询索引：list 端点（owner 的 preset + scope filter）
CREATE INDEX IF NOT EXISTS idx_ufp_owner_scope_tab
  ON user_filter_presets (owner_user_id, scope, tab);

-- is_default 单一性硬约束：同 owner 同 tab 最多 1 个 default
CREATE UNIQUE INDEX IF NOT EXISTS idx_ufp_default_unique
  ON user_filter_presets (owner_user_id, tab)
  WHERE is_default = TRUE;

-- shared preset 列表查询：全 moderator 可见
CREATE INDEX IF NOT EXISTS idx_ufp_shared_tab
  ON user_filter_presets (scope, tab)
  WHERE scope = 'shared';

-- updated_at 自动触发器（与仓内 videos / users 同范式）
CREATE OR REPLACE FUNCTION trg_ufp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_filter_presets_updated
  BEFORE UPDATE ON user_filter_presets
  FOR EACH ROW
  EXECUTE FUNCTION trg_ufp_updated_at();

COMMIT;
