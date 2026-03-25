-- Migration 016: 审核状态 / 可见性状态 + is_published 数据迁移
-- CHG-173: ADR-018 内容治理基础层
-- 同一事务内 ALTER + UPDATE（序列约束 3）

BEGIN;

-- ── 新增字段 ─────────────────────────────────────────────────────

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (review_status IN ('pending_review','approved','rejected')),
  ADD COLUMN IF NOT EXISTS visibility_status TEXT NOT NULL DEFAULT 'internal'
    CHECK (visibility_status IN ('public','internal','hidden')),
  ADD COLUMN IF NOT EXISTS review_reason TEXT,
  ADD COLUMN IF NOT EXISTS review_source TEXT
    CHECK (review_source IN ('manual','auto','crawler') OR review_source IS NULL),
  ADD COLUMN IF NOT EXISTS reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS needs_manual_review BOOLEAN NOT NULL DEFAULT false;

-- ── 数据迁移：is_published=true → public/approved ────────────────

UPDATE videos
SET
  visibility_status = 'public',
  review_status     = 'approved',
  review_source     = 'auto'
WHERE is_published = true
  AND visibility_status = 'internal';  -- 仅更新 default 值，避免重复执行时覆盖

-- ── 数据迁移：is_published=false → internal/pending_review ───────

-- 已是 default 值（internal / pending_review），无需额外 UPDATE

COMMIT;
