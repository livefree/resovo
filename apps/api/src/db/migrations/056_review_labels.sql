-- 056_review_labels.sql
-- 描述：预设审核标签表，支持结构化拒绝标签 + 审核数据分析
-- 日期：2026-05-01
-- ADR：ADR-109 关联 / M-SN-4 plan v1.4 §2.5
-- 任务卡：CHG-SN-4-03 / SEQ-20260501-01
-- 幂等：是（CREATE TABLE IF NOT EXISTS / INSERT … ON CONFLICT DO NOTHING）
--
-- schema：
--   id            UUID PK
--   label_key     TEXT NOT NULL UNIQUE（应用层引用 key，对应 videos.review_label_key 软引用）
--   label         TEXT NOT NULL（中文文案）
--   applies_to    TEXT NOT NULL CHECK 3 值（reject/approve/any）
--   display_order INT NOT NULL（前端 RejectModal 排序）
--   is_active     BOOLEAN NOT NULL（停用旧标签时置 false，保留历史可读性）
--   created_at    TIMESTAMPTZ NOT NULL
--
-- 种子数据（plan v1.4 §2.5）：8 个标签，display_order 1–7 + 99（other 兜底）。
--
-- ⚠️  Down 路径说明（项目约定）：注释形式留存。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS review_labels (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  label_key     TEXT         NOT NULL UNIQUE,
  label         TEXT         NOT NULL,
  applies_to    TEXT         NOT NULL DEFAULT 'reject'
                              CHECK (applies_to IN ('reject', 'approve', 'any')),
  display_order INT          NOT NULL DEFAULT 0,
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE review_labels
  IS '预设审核标签字典；videos.review_label_key 软引用 label_key（不加 FK 防演进锁死）；plan v1.4 §2.5';

-- 种子数据（plan v1.4 §2.5）
INSERT INTO review_labels (label_key, label, applies_to, display_order) VALUES
  ('all_dead',        '全线路失效',   'reject',  1),
  ('duplicate',       '重复内容',     'reject',  2),
  ('violation',       '内容违规',     'reject',  3),
  ('cover_missing',   '封面缺失',     'reject',  4),
  ('incomplete_meta', '元数据不完整', 'reject',  5),
  ('low_quality',     '画质过低',     'reject',  6),
  ('region_blocked',  '地区限制',     'reject',  7),
  ('other',           '其他',         'any',    99)
ON CONFLICT (label_key) DO NOTHING;

-- applies_to 索引（按"拒绝可选标签"筛选 / 按"任何场景"筛选）
CREATE INDEX IF NOT EXISTS idx_review_labels_applies_to_active
  ON review_labels (applies_to, is_active, display_order)
  WHERE is_active = true;

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- DROP INDEX IF EXISTS idx_review_labels_applies_to_active;
-- DROP TABLE IF EXISTS review_labels;
-- COMMIT;
