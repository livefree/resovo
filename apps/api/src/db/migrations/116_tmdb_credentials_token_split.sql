-- 116_tmdb_credentials_token_split.sql
-- 描述：TMDB 凭证字段拆分——api_credentials tmdb 行的 secrets.token（语义即 Bearer Read Access Token）
--      改名为 read_access_token，对齐 ADR-201 §凭证语义（token→read_access_token + api_key 分离）
-- 日期：2026-06-14
-- 决策真源：docs/decisions.md ADR-201 §「API 凭证与 TMDB 接入」§凭证语义「存量迁移」（amend ADR-173 D-173-2）
-- 任务卡：META-37-A / SEQ-20260614-01
-- 子代理：arch-reviewer (claude-opus-4-8, agentId a6c0adf46c51267c5) 前置契约+迁移评审 CONDITIONAL-PASS（C1 空串守卫）
-- 幂等：是（守卫 secrets ? 'token' AND NOT secrets ? 'read_access_token' AND secrets->>'token' <> ''；
--      复跑时 token key 已被移除 → 不再命中，安全重复执行）
--
-- ⚠️ 事务：由 scripts/migrate.ts 外层 BEGIN/COMMIT 包裹，本文件内不写 BEGIN/COMMIT（105/112/115 先例）。
-- ⚠️ Down 路径：注释形式留存（项目约定）。
--
-- 语义：现状 api_credentials.secrets.token（115 回填自 system_settings.tmdb_api_key，或经端点写入；
--   label「API Read Access Token」）→ 迁入 read_access_token（语义即 Bearer，用途不变，ADR-201 22821）。
--   legacy system_settings.tmdb_api_key 的 KV fallback 映射改走 api_key 由解析器层处理（不在本迁移，
--   见 integration-credentials-config.ts LEGACY_KV_MAP）。
-- 空串守卫（C1/R1）：与 115 回填 `<> ''` 语义对齐——迁移自洁，不依赖上游不变量、不把空串脏值迁入新 key。
-- 并存守卫：NOT secrets ? 'read_access_token' 防覆盖已有 Bearer（端点已写新字段的行不回退）。

UPDATE api_credentials
SET secrets = (secrets - 'token') || jsonb_build_object('read_access_token', secrets->>'token'),
    updated_at = NOW()
WHERE provider = 'tmdb'
  AND secrets ? 'token'
  AND NOT (secrets ? 'read_access_token')
  AND secrets->>'token' <> '';

-- ── down ─────────────────────────────────────────────────────────────────────
-- UPDATE api_credentials
-- SET secrets = (secrets - 'read_access_token') || jsonb_build_object('token', secrets->>'read_access_token'),
--     updated_at = NOW()
-- WHERE provider = 'tmdb'
--   AND secrets ? 'read_access_token'
--   AND NOT (secrets ? 'token')
--   AND secrets->>'read_access_token' <> '';
