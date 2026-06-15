-- 118_tmdb_legacy_apikey_reclassify.sql
-- 描述：订正 migration 115 把 legacy v3 `system_settings.tmdb_api_key` 误回填入 Bearer 槽的回归——
--      把「值 == legacy tmdb_api_key」的 tmdb 凭证 secret 从 read_access_token/token 槽迁到 api_key 槽。
-- 日期：2026-06-15
-- 决策真源：docs/decisions.md ADR-201 §凭证语义 22822「legacy tmdb_api_key 是 v3 API Key，不回填为 Bearer」
-- 任务卡：META-37-A-FIX（Codex 复审 P2-1）
-- 子代理：无
--
-- ⚠️ 事务：由 scripts/migrate.ts 外层 BEGIN/COMMIT 包裹，本文件内不写 BEGIN/COMMIT（105/112/115/116/117 先例）。
-- ⚠️ Down 路径：注释形式留存（项目约定）。
--
-- 根因：migration 115（2026-06-13，早于 22822 决策）把 system_settings.tmdb_api_key（v3 API Key，
--   语义应为 query ?api_key=）回填入 api_credentials.secrets.token（Bearer 槽）；116 又把 token→
--   read_access_token，且读路径 normalizeRowSecrets（read_access_token←token）一并 propagate。
--   → 有 api_credentials 行时解析器读 read_access_token 当 Bearer 发，v3 key 当 Bearer 致 TMDB 401，
--   而正确的 v3 api_key fallback（integration-credentials-config.ts LEGACY_KV_MAP）因「行已存在」永不可达。
--
-- 修复信号（精确）：仅当 secret 的 Bearer 槽值 == 现存 system_settings.tmdb_api_key 值时，才判定其为
--   legacy v3 key 误填（D-173-8 过渡期保留旧 KV 只读，故信号可用）。端点写入的真 v4 Bearer 与 legacy v3
--   值不同 → 不命中、不误伤。fresh 安装亦按 115→116→118 顺序落到 api_key 正确终态。
--
-- 守卫（幂等 + 防误伤）：
--   ① ss.value <> ''            —— legacy KV 有值才比对；
--   ② Bearer 槽值 = ss.value    —— 精确 legacy-backfill 信号（真 Bearer 不等于 v3 key）；
--   ③ NOT (secrets ? 'api_key') —— 不覆盖已通过端点设置的 api_key。
--   复跑：read_access_token/token 已被移除 → COALESCE 取值为 NULL ≠ ss.value → 不再命中（幂等）。

UPDATE api_credentials AS ac
SET secrets = (ac.secrets - 'read_access_token' - 'token')
              || jsonb_build_object('api_key',
                   COALESCE(NULLIF(ac.secrets->>'read_access_token', ''), ac.secrets->>'token')),
    updated_at = NOW()
FROM system_settings ss
WHERE ac.provider = 'tmdb'
  AND ss.key = 'tmdb_api_key'
  AND ss.value <> ''
  AND COALESCE(NULLIF(ac.secrets->>'read_access_token', ''), ac.secrets->>'token') = ss.value
  AND NOT (ac.secrets ? 'api_key');

-- ── down ─────────────────────────────────────────────────────────────────────
-- 不可逆精确回滚（迁移后原 Bearer/api_key 槽来源不可区分）；如需回退，按 116 的语义
-- 把 api_key 重新视作 read_access_token：
-- UPDATE api_credentials AS ac
-- SET secrets = (ac.secrets - 'api_key') || jsonb_build_object('read_access_token', ac.secrets->>'api_key'),
--     updated_at = NOW()
-- FROM system_settings ss
-- WHERE ac.provider = 'tmdb' AND ss.key = 'tmdb_api_key' AND ss.value <> ''
--   AND ac.secrets->>'api_key' = ss.value
--   AND NOT (ac.secrets ? 'read_access_token');
