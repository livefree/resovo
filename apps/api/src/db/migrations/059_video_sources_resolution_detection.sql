-- 059_video_sources_resolution_detection.sql
-- 描述：video_sources 新增"实测分辨率"字段，与既有 quality（采集声明分辨率）双轨并存
-- 日期：2026-05-01
-- ADR：ADR-109 关联 / M-SN-4 plan v1.4 §2.8
-- 任务卡：CHG-SN-4-03 / SEQ-20260501-01
-- 幂等：是（quality_source 走三步幂等模式 — 详见下方"幂等性深度分析"）
--
-- 既有 quality 列（001 init）：CHECK 5 值（4K/1080P/720P/480P/360P），来自采集时声明
-- 059 新增 5 列：实测分辨率 + 来源 + 像素维度 + 探测时间
--   quality_detected   TEXT NULL CHECK 7 值（含 2K / 240P；前端高精度展示）
--   quality_source     TEXT NOT NULL DEFAULT 'crawler' CHECK 4 值（v1.4 三步幂等强约束）
--   resolution_width   INT NULL（实测像素宽）
--   resolution_height  INT NULL（实测像素高）
--   detected_at        TIMESTAMPTZ NULL
--
-- ────── 幂等性深度分析（v1.4 stop hook 第七轮反馈修复 — safe convergence 终版）──────
--
-- 错误模式 1（v1.4 初版）：ADD COLUMN IF NOT EXISTS ... NOT NULL DEFAULT 'crawler';
--   IF NOT EXISTS 在列已存在时跳过 → NOT NULL 不生效。
--
-- 错误模式 2（v1.4 第六轮版本）：Step 1 ADD COLUMN ... CHECK（无 DEFAULT）+ Step 2 UPDATE WHERE col IS NULL AND deleted_at IS NULL
--   → 软删除行漏 backfill → Step 3 SET NOT NULL 扫全表（含软删除）→ 失败拒绝 migration
--   = 不能安全收敛 existing schemas（第七轮反馈"do not safely converge existing schemas"）。
--
-- 正解（与 060 同模式）：
--   1. ADD COLUMN IF NOT EXISTS quality_source TEXT DEFAULT 'crawler' CHECK 4 值（带 DEFAULT 不带 NOT NULL）
--      - 列不存在：PG fast default 自动 backfill **所有行（含软删除）**为 'crawler'
--      - 列已存在：跳过；保持原状
--   2. UPDATE WHERE quality_source IS NULL backfill 'crawler'（**全表，无 deleted_at 过滤**）
--      - 兜底 v1.3 残留 NULL（含软删除行）
--   3. ALTER COLUMN SET DEFAULT + SET NOT NULL（幂等收敛终态）
--
-- 前端 fallback 链（plan §1 D-12）：quality_detected ?? quality
-- 应用层档位映射规则（plan v1.3 §2.8）：
--   resolution_height ≥ 2160  → '4K'
--   resolution_height ≥ 1440  → '2K'
--   resolution_height ≥ 1080  → '1080P'
--   resolution_height ≥ 720   → '720P'
--   resolution_height ≥ 480   → '480P'
--   resolution_height ≥ 360   → '360P'
--   resolution_height < 360   → '240P'
--
-- ⚠️  Down 路径说明（项目约定）：注释形式留存。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

-- Step 1: 列建表（quality_source 带 DEFAULT 'crawler' 不带 NOT NULL；其他列 NULL 允许）
--   列不存在场景：PG 11+ fast default 自动 backfill 所有行（含软删除）为 'crawler'
--   列已存在场景：IF NOT EXISTS 跳过；保持原状（留待 Step 2 兜底）
ALTER TABLE video_sources
  ADD COLUMN IF NOT EXISTS quality_detected TEXT
    CHECK (quality_detected IN ('4K', '2K', '1080P', '720P', '480P', '360P', '240P')),
  ADD COLUMN IF NOT EXISTS quality_source TEXT DEFAULT 'crawler'
    CHECK (quality_source IN ('crawler', 'manifest_parse', 'player_feedback', 'admin_review')),
  ADD COLUMN IF NOT EXISTS resolution_width  INT,
  ADD COLUMN IF NOT EXISTS resolution_height INT,
  ADD COLUMN IF NOT EXISTS detected_at       TIMESTAMPTZ;

-- Step 2: 全表清理 NULL 残留（兜底 v1.3 残留；**无 deleted_at 过滤**确保软删除行也 backfill）
--   软删除行 quality_source='crawler' 兜底默认语义无害
--   空表 / 已无 NULL 时 0 行影响
UPDATE video_sources SET quality_source = 'crawler' WHERE quality_source IS NULL;

-- Step 3: 幂等强约束 quality_source（SET 操作 PG 幂等无副作用）
--   SET NOT NULL 扫全表此时全部非 NULL → 安全
ALTER TABLE video_sources
  ALTER COLUMN quality_source SET DEFAULT 'crawler';

ALTER TABLE video_sources
  ALTER COLUMN quality_source SET NOT NULL;

COMMENT ON COLUMN video_sources.quality_detected
  IS '实测分辨率档位；CHECK 7 值（含 2K/240P）；NULL 表示尚未实测；前端 fallback quality_detected ?? quality';
COMMENT ON COLUMN video_sources.quality_source
  IS '分辨率来源；NOT NULL DEFAULT crawler；CHECK 4 值；三步幂等模式收敛 existing schemas（plan v1.4 §2.8）';
COMMENT ON COLUMN video_sources.resolution_width
  IS '实测视频宽度（像素）；用于精确分辨率判断（如 1920×1080 vs 1280×720）';
COMMENT ON COLUMN video_sources.resolution_height
  IS '实测视频高度（像素）；按 plan §2.8 映射规则解析为 quality_detected';
COMMENT ON COLUMN video_sources.detected_at
  IS '实测时间；NULL 表示尚未实测';

-- 便于查找"质量缺失"线路优先 Level 2 渲染验证（worker 任务）
CREATE INDEX IF NOT EXISTS idx_video_sources_quality_null
  ON video_sources (probe_status)
  WHERE quality_detected IS NULL AND deleted_at IS NULL AND is_active = true;

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- DROP INDEX IF EXISTS idx_video_sources_quality_null;
-- ALTER TABLE video_sources
--   DROP COLUMN IF EXISTS detected_at,
--   DROP COLUMN IF EXISTS resolution_height,
--   DROP COLUMN IF EXISTS resolution_width,
--   DROP COLUMN IF EXISTS quality_source,
--   DROP COLUMN IF EXISTS quality_detected;
-- COMMIT;
