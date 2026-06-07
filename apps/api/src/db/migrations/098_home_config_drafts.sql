-- 098_home_config_drafts.sql
-- ADR-185 D-185-1.3（草稿覆盖层表）
-- CHG-HOME-DRAFT-PUBLISH-A / SEQ-20260605-05 Phase 4
--
-- 草稿 = 整页 JSONB 覆盖层（与 097 版本快照同构型 HomePageConfig 三键）。
-- 首版全局单草稿行：UNIQUE(scope) + 恒 'global'；多 brand 草稿留 scope 列扩展位
-- 不实现（D-185-1.3 / D-185-6.2，需求出现时 ADR amendment）。
-- base_version_no = 创建草稿时的最新版本号（陈旧检测锚点，D-185-2.2 双信号之一；
-- 不设 FK——锚而非关系，未来版本归档不受草稿牵制，失锚即读作陈旧）。
-- 草稿保存/丢弃不计 admin audit（D-185-3.1：编辑态噪音；§11 审计锚定发布动作）。
--
-- ⚠️  Down 路径说明（项目约定）：
--   scripts/migrate.ts 将整个文件内容作为单条 SQL 执行，不区分 up/down 节。
--   down 路径必须保持注释形式；需要回滚时手动解注释独立执行（与 049/050/094–097 同约定）。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS home_config_drafts (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 首版恒 'global'（UNIQUE 约束单行）；多 brand 扩展位（D-185-1.3）
  scope            TEXT         NOT NULL DEFAULT 'global' UNIQUE,
  -- 整页覆盖层三键 { banners, modules, settings }（HomePageConfig，与版本快照同构）
  config           JSONB        NOT NULL,
  -- 创建草稿时的最新 version_no；NULL = 冷启动期（无版本）。冲突更新不重置锚
  base_version_no  INTEGER      NULL,
  created_by       UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by       UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION home_config_drafts_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS home_config_drafts_set_updated_at_trg ON home_config_drafts;
CREATE TRIGGER home_config_drafts_set_updated_at_trg
  BEFORE UPDATE ON home_config_drafts
  FOR EACH ROW EXECUTE FUNCTION home_config_drafts_set_updated_at();

COMMENT ON TABLE home_config_drafts
  IS '首页配置草稿覆盖层（ADR-185 D-185-1.3）；全局单行（UNIQUE scope）；base_version_no 为陈旧检测锚；保存/丢弃不计 admin audit（D-185-3.1）';

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- DROP TRIGGER IF EXISTS home_config_drafts_set_updated_at_trg ON home_config_drafts;
-- DROP FUNCTION IF EXISTS home_config_drafts_set_updated_at();
-- DROP TABLE IF EXISTS home_config_drafts;
-- COMMIT;
