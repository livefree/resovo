-- 096_home_autofill_snapshots.sql
-- ADR-183 D-183-2（候选快照表）
-- CHG-HOME-AUTOFILL-CORE-B / SEQ-20260605-05 Phase 3
--
-- 自动填充候选快照：worker 整份生成、端点 #4 整份只读消费、写后零 UPDATE（不可变）。
-- candidates/gaps 走 JSONB 数组而非行级子表（D-183-2 论证：无行级 WHERE / 索引需求，
-- 不触犯 ADR-052 metadata 守则——守则禁的是「需要 WHERE 过滤的关键字段」入 JSONB）。
-- 保留策略：每 section 最近 10 份，写入与清理同事务（queries 层执行）。
-- 快照属系统产物，写入不计 admin audit（方案 §11.2；人工触发 refresh 在端点层记录）。
--
-- ⚠️  Down 路径说明（项目约定）：
--   scripts/migrate.ts 将整个文件内容作为单条 SQL 执行，不区分 up/down 节。
--   down 路径必须保持注释形式；需要回滚时手动解注释独立执行（与 049/050/094/095 同约定）。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS home_autofill_snapshots (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- HomeSectionKey 7 值——与 095 home_section_settings 为两处同源字面量，
  -- 扩值必须同卡同步两表 CHECK（D-183-2；ADR-181 compat BLOCKER 同款教训）
  section           TEXT         NOT NULL
                                   CHECK (section IN (
                                     'banner', 'type_shortcuts', 'featured', 'top10',
                                     'hot_movies', 'hot_series', 'hot_anime'
                                   )),
  -- 即端点 #4 snapshotAt（与 #2 sections 摘要「最近候选快照时间」同语义同源）
  generated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- 定时 vs 手动刷新（端点 #7）
  trigger           TEXT         NOT NULL CHECK (trigger IN ('scheduled', 'manual')),
  -- 策略代码版本常量（D-183-5；语义变更必须递增）
  policy_version    TEXT         NOT NULL,
  -- 重算时的 section settings 快照（审计回溯链，方案 §11.2）
  settings_snapshot JSONB        NOT NULL,
  -- AutofillCandidate[]（ADR-182 D-182-4.4 DTO 同构，含 filtered 条目）
  candidates        JSONB        NOT NULL DEFAULT '[]'::jsonb,
  -- ContentGap[] 缺口 top-N（D-183-7.3；独立 DTO 无 videoId）
  gaps              JSONB        NOT NULL DEFAULT '[]'::jsonb,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 端点 #4 取最新快照的唯一查询路径（D-183-2）
CREATE INDEX IF NOT EXISTS idx_home_autofill_snapshots_section_generated
  ON home_autofill_snapshots (section, generated_at DESC);

COMMENT ON TABLE home_autofill_snapshots
  IS '自动填充候选快照（ADR-183 D-183-2）；worker 整份写入不可变，每 section 保留最近 10 份（写入+清理同事务）；系统产物不计 admin audit';

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- DROP INDEX IF EXISTS idx_home_autofill_snapshots_section_generated;
-- DROP TABLE IF EXISTS home_autofill_snapshots;
-- COMMIT;
