-- 060_videos_review_source.sql
-- 描述：videos 新增 review_source 列，区分审核来源（自动 / 手动 / 采集）
-- 日期：2026-05-01
-- ADR：ADR-109 关联 / M-SN-4 plan v1.4 §2.9
-- 任务卡：CHG-SN-4-03 / SEQ-20260501-01
-- 幂等：是（三步幂等模式 — 详见下方"幂等性深度分析"）
--
-- 新增 1 列：
--   review_source TEXT NOT NULL DEFAULT 'manual' CHECK 3 值
--
-- ────── 幂等性深度分析（v1.4 stop hook 第七轮反馈修复 — safe convergence 终版）──────
--
-- 错误模式 1（v1.4 初版，第六轮反馈）：
--   ADD COLUMN IF NOT EXISTS review_source TEXT NOT NULL DEFAULT 'manual' CHECK ...;
--   IF NOT EXISTS 在列已存在时跳过整条 → NOT NULL/DEFAULT/CHECK 都不生效。
--
-- 错误模式 2（v1.4 第六轮版本，第七轮反馈"do not safely converge existing schemas"）：
--   Step 1 ADD COLUMN ... CHECK（无 DEFAULT）→ existing 行（含软删除行）review_source = NULL
--   Step 2 UPDATE WHERE col IS NULL AND deleted_at IS NULL → **软删除行漏 backfill**
--   Step 3 ALTER COLUMN SET NOT NULL → **扫全表（含软删除行）→ 软删除行 NULL → 失败拒绝 migration**
--   = 不能安全收敛 existing schemas。
--
-- 正解（v1.4 第七轮终版三步幂等 + safe convergence）：
--   1. ADD COLUMN IF NOT EXISTS col TEXT DEFAULT 'manual' CHECK (...)
--      - 列不存在：PG 11+ fast default 自动 backfill **所有行（含软删除）**为 'manual'
--      - 列已存在（v1.3 残留）：跳过整条；保持原状
--      - 不带 NOT NULL（留待 Step 3 强约束；避免 v1.3 残留 + 隐含 NULL 行触发 NOT NULL 失败）
--   2. UPDATE col = 'manual' WHERE col IS NULL（**全表，无 deleted_at 过滤**）
--      - 兜底场景：v1.3 残留期间应用层显式插入 NULL（含软删除前 NULL 残留）
--      - 软删除行也 backfill；软删除行 review_source='manual' 语义无害（兜底默认）
--      - 空表 / 已无 NULL 时 0 行影响
--   3. ALTER COLUMN SET DEFAULT 'manual'; ALTER COLUMN SET NOT NULL
--      - 已 NOT NULL/DEFAULT 列幂等
--      - SET NOT NULL 扫全表此时全部非 NULL → 安全
--   收敛行为：列预存在/不存在 + 任意 NULL 分布（含软删除行 NULL）→ 终态 NOT NULL DEFAULT 'manual'。
--
-- 应用层 types 收紧为 ReviewSource（非空；admin-moderation.types.ts v1.4 同步）。
--
-- 用途：右侧元数据面板显示极小 tag（自动 / 手动 / 采集），仅 admin 可见。
--
-- ⚠️  Down 路径说明（项目约定）：注释形式留存。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

-- Step 1: 列建表（CHECK + DEFAULT 'manual'；不带 NOT NULL）
--   列不存在场景：PG 11+ fast default 自动 backfill 所有行（含软删除）为 'manual'
--   列已存在场景：IF NOT EXISTS 跳过整条，保持原状（留待 Step 2 兜底）
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS review_source TEXT DEFAULT 'manual'
    CHECK (review_source IN ('auto', 'manual', 'crawler'));

-- Step 2: 全表清理 NULL 残留（兜底 v1.3 残留 — 应用层期间可能显式插入过 NULL）
--   **无 deleted_at 过滤**：软删除行也必须 backfill，否则 Step 3 SET NOT NULL 失败
--   软删除行 review_source='manual' 兜底默认语义无害
--   空表 / 已无 NULL 时 0 行影响
UPDATE videos SET review_source = 'manual' WHERE review_source IS NULL;

-- Step 3: 幂等强约束（PG ALTER COLUMN SET 对已 NOT NULL/DEFAULT 列幂等无副作用）
--   SET NOT NULL 扫全表此时全部非 NULL → 安全
ALTER TABLE videos
  ALTER COLUMN review_source SET DEFAULT 'manual';

ALTER TABLE videos
  ALTER COLUMN review_source SET NOT NULL;

COMMENT ON COLUMN videos.review_source
  IS '审核来源：auto=规则自动通过 / manual=人工审核 / crawler=采集时初评；NOT NULL DEFAULT manual；三步幂等模式收敛 existing schemas（plan v1.4 §2.9）';

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- ALTER TABLE videos DROP COLUMN IF EXISTS review_source;
-- COMMIT;
