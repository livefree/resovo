-- 097_home_publish_versions.sql
-- ADR-185 D-185-1.2（版本快照表）+ D-185-3.5（audit target_kind 16→17）
-- CHG-HOME-DRAFT-PUBLISH-A / SEQ-20260605-05 Phase 4
--
-- 发布版本：发布动作将三真源表（home_banners / home_modules / home_section_settings）
-- 全量配置拍成整页 JSONB 快照（banners + modules + settings 三键），version_no 单调递增。
-- 回滚 = 按目标版本快照恢复三表 + 自身记为新版本行（roll-forward 范式：不删不改历史，
-- 回滚本身可再回滚）。整页 JSONB 不触犯 ADR-052 metadata 守则——快照为不可变归档，
-- 无行级 WHERE / 索引需求（096 候选快照同论证）。
-- 保留策略：不设上限（D-185-1.6——低频人工动作 + roll-forward 依赖完整历史链；
-- 版本数 > 1000 或单行 config > 1MB 时评估归档，届时 ADR amendment）。
-- 冷启动语义（D-185-1.5）：空表 = 历史直写期配置即事实发布态；首次 publish 拍 version 1。
--
-- ⚠️  Down 路径说明（项目约定）：
--   scripts/migrate.ts 将整个文件内容作为单条 SQL 执行，不区分 up/down 节。
--   down 路径必须保持注释形式；需要回滚时手动解注释独立执行（与 049/050/094/095/096 同约定）。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS home_publish_versions (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 单调递增（serial；事务回滚可留空洞，单调性不受影响）
  version_no    SERIAL       NOT NULL UNIQUE,
  -- 发布 vs 回滚产生的版本（D-185-1.2；回滚 roll-forward 自记新版本）
  source        TEXT         NOT NULL CHECK (source IN ('publish', 'rollback')),
  note          TEXT         NULL,
  -- 整页快照三键 { banners, modules, settings }（HomePageConfig，camelCase DTO 同构）
  config        JSONB        NOT NULL,
  published_by  UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  published_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- audit target_kind CHECK 16 → 17：+home_page（ADR-185 D-185-3.5；088/095 同范式。
-- action_type 列无 DB CHECK——D-182-5.2 既有裁定，home_page.publish/rollback 仅 TS 枚举三处）
ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_target_kind_check;
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_target_kind_check
  CHECK (target_kind IN (
    'video', 'video_source', 'staging', 'review_label', 'crawler_site', 'system',
    'home_module', 'source_line_alias', 'source_route', 'user_submission', 'image_health',
    'user', 'filter_preset', 'crawler_task', 'identity_candidate', 'home_section',
    'home_page'
  ));

COMMENT ON COLUMN admin_audit_log.target_kind
  IS 'CHECK 限定 17 种（ADR-185 扩展 home_page；16→17）';

COMMENT ON TABLE home_publish_versions
  IS '首页发布版本快照（ADR-185 D-185-1.2）；整页 JSONB roll-forward 不可变归档，不设保留上限（D-185-1.6）；audit home_page.* 的 target_id 锚点';

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_target_kind_check;
-- ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_target_kind_check
--   CHECK (target_kind IN (
--     'video', 'video_source', 'staging', 'review_label', 'crawler_site', 'system',
--     'home_module', 'source_line_alias', 'source_route', 'user_submission', 'image_health',
--     'user', 'filter_preset', 'crawler_task', 'identity_candidate', 'home_section'
--   ));
-- DROP TABLE IF EXISTS home_publish_versions;
-- COMMIT;
