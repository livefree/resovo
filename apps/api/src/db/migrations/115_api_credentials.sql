-- 115_api_credentials.sql
-- 描述：API 凭证统一管理框架——新建 api_credentials 表 + 从 system_settings 回填 bangumi/tmdb 现值
-- 日期：2026-06-13
-- 决策真源：docs/decisions.md ADR-173 §D-173-1（表 schema）/ §D-173-8（两阶段迁移：回填保留旧 KV）
-- 任务卡：META-25（Card A1）/ SEQ-20260613-01
-- 子代理：无（claude-opus-4-8 主循环起草 ADR-173 + 自审；Codex hook 复审）
-- 幂等：是（CREATE TABLE IF NOT EXISTS + 回填 ON CONFLICT DO NOTHING；可重复执行）
--
-- ⚠️ 事务：由 scripts/migrate.ts 外层 BEGIN/COMMIT 包裹，本文件内不写 BEGIN/COMMIT（105/112 先例）。
-- ⚠️ Down 路径：注释形式留存（项目约定）。
--
-- D-173-1：一源一行；secrets/config 物理分列——secrets JSONB 承载敏感字段（遮罩/redact/占位跳过），
--   config JSONB 承载非敏感字段（明文回传）。遮罩真源是注册表 secret flag（ADR-173 D-173-4），
--   不依赖 key 名正则。last_test_* 仅记录「已保存配置」测试（草稿测试不写，D-173-5）。
-- D-173-8：回填 system_settings 现值入新表但**保留旧 KV 值只读**——过渡期解析器缺行 fallback 旧 KV，
--   物理退役推迟 Card D（META-29，线上稳定后单独排期）。回填 ON CONFLICT DO NOTHING：不覆盖
--   新表后续经端点写入的值（幂等复跑安全）。
-- D-173-11：updated_by 保 FK（对齐 admin_audit_log.actor_id 惯例，migration 052）；本表 admin-only
--   配置表，所有读写仅经鉴权 route，不入未登录路径。ON DELETE SET NULL（回填行 updated_by 可空）。

CREATE TABLE IF NOT EXISTS api_credentials (
  provider             TEXT        PRIMARY KEY,
  secrets              JSONB       NOT NULL DEFAULT '{}'::jsonb,
  config               JSONB       NOT NULL DEFAULT '{}'::jsonb,
  enabled              BOOLEAN     NOT NULL DEFAULT TRUE,
  last_tested_at       TIMESTAMPTZ NULL,
  last_test_ok         BOOLEAN     NULL,
  last_test_latency_ms INTEGER     NULL,
  last_test_error      TEXT        NULL,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by           UUID        NULL REFERENCES users(id) ON DELETE SET NULL
);

COMMENT ON TABLE api_credentials
  IS 'API 凭证统一管理（ADR-173）：外部数据源 API 凭证一源一行。provider=ProviderKey（DB 开放字符串，route/service z.enum(PROVIDER_KEYS) 守门，D-173-9）。admin-only 配置表（D-173-11）';
COMMENT ON COLUMN api_credentials.secrets
  IS '敏感字段 map（ADR-173 D-173-1/D-173-4）：{ token?, ... }。GET 逐字段遮罩、PUT 占位跳过、审计 redact——以注册表 secret flag 为真源。明文存储（at-rest 加密 NEGATED 延续 ADR-168 D-168-6，D-173-A）';
COMMENT ON COLUMN api_credentials.config
  IS '非敏感字段 map（ADR-173 D-173-1）：{ userAgent?, timeoutMs?, baseUrl?, language? }。GET 明文回传';
COMMENT ON COLUMN api_credentials.enabled
  IS 'D-173-3 enabled 语义：false 压过 env 回退——解析器对 disabled 源不注入任何凭证（等同未配置）；但仍允许测试';
COMMENT ON COLUMN api_credentials.last_tested_at
  IS 'D-173-5：仅记录「已保存配置」连接测试（draft=true 候选输入测试不写行级状态，防误导）';

-- ── 回填（D-173-8，幂等，保留旧 KV）─────────────────────────────────────────────
DO $$
DECLARE
  v_token   TEXT;
  v_ua      TEXT;
  v_timeout TEXT;
  v_secrets JSONB;
  v_config  JSONB;
BEGIN
  -- bangumi：bangumi_api_token → secrets.token / user_agent → config.userAgent / timeout_ms → config.timeoutMs
  SELECT value INTO v_token   FROM system_settings WHERE key = 'bangumi_api_token';
  SELECT value INTO v_ua      FROM system_settings WHERE key = 'bangumi_user_agent';
  SELECT value INTO v_timeout FROM system_settings WHERE key = 'bangumi_api_timeout_ms';

  v_secrets := '{}'::jsonb;
  IF v_token IS NOT NULL AND v_token <> '' THEN
    v_secrets := jsonb_build_object('token', v_token);
  END IF;
  v_config := '{}'::jsonb;
  IF v_ua IS NOT NULL AND v_ua <> '' THEN
    v_config := v_config || jsonb_build_object('userAgent', v_ua);
  END IF;
  IF v_timeout IS NOT NULL AND v_timeout ~ '^\d+$' THEN
    v_config := v_config || jsonb_build_object('timeoutMs', (v_timeout)::int);
  END IF;
  IF v_secrets <> '{}'::jsonb OR v_config <> '{}'::jsonb THEN
    INSERT INTO api_credentials (provider, secrets, config)
    VALUES ('bangumi', v_secrets, v_config)
    ON CONFLICT (provider) DO NOTHING;
  END IF;

  -- tmdb：tmdb_api_key → secrets.token（Bearer 主契约，D-173-2）
  SELECT value INTO v_token FROM system_settings WHERE key = 'tmdb_api_key';
  IF v_token IS NOT NULL AND v_token <> '' THEN
    INSERT INTO api_credentials (provider, secrets, config)
    VALUES ('tmdb', jsonb_build_object('token', v_token), '{}'::jsonb)
    ON CONFLICT (provider) DO NOTHING;
  END IF;
END $$;

-- ── down ─────────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS api_credentials;
