-- 055_videos_moderation_fields.sql
-- 描述：videos 新增 staff_note（审核员过程备注）和 review_label_key（预设拒绝标签 key）
-- 日期：2026-05-01
-- ADR：ADR-109 关联 / M-SN-4 plan v1.3 §2.4
-- 任务卡：CHG-SN-4-03 / SEQ-20260501-01
-- 幂等：是（ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS）
--
-- 新增 2 列：
--   staff_note       TEXT NULL（审核员过程备注，不随状态迁移清空，可多次编辑）
--   review_label_key TEXT NULL（拒绝/标记时选用的预设标签 key，对应 review_labels.label_key）
-- review_label_key 软引用 review_labels.label_key（CHECK + UNIQUE 而非 FK），防标签演进锁死迁移。
--
-- 索引：仅在 review_label_key 非空时入索引（partial index）。
--
-- ⚠️  Down 路径说明（项目约定）：注释形式留存。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS staff_note       TEXT,
  ADD COLUMN IF NOT EXISTS review_label_key TEXT;

COMMENT ON COLUMN videos.staff_note
  IS '审核员过程备注；不随状态迁移清空，可多次编辑（plan v1.3 §5.1 staffNote 编辑流）';
COMMENT ON COLUMN videos.review_label_key
  IS '拒绝/标记时选用的预设标签 key，软引用 review_labels.label_key（056 创建）；不加 FK 防演进锁死';

CREATE INDEX IF NOT EXISTS idx_videos_review_label_key
  ON videos (review_label_key)
  WHERE deleted_at IS NULL AND review_label_key IS NOT NULL;

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- DROP INDEX IF EXISTS idx_videos_review_label_key;
-- ALTER TABLE videos
--   DROP COLUMN IF EXISTS review_label_key,
--   DROP COLUMN IF EXISTS staff_note;
-- COMMIT;
