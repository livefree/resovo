-- 053_state_machine_add_staging_revert.sql
-- 描述：状态机白名单新增"暂存退回待审"两条转换（M-SN-4 D-01）
-- 日期：2026-05-01
-- ADR：ADR-109 关联 / M-SN-4 plan v1.3 §2.2
-- 任务卡：CHG-SN-4-03 / SEQ-20260501-01
-- 幂等：是（CREATE OR REPLACE FUNCTION + DROP/CREATE TRIGGER）
--
-- 新增转换（plan §1 D-01）：
--   approved|internal|0 → pending_review|internal|0（暂存退回待审，从 internal）
--   approved|hidden|0   → pending_review|hidden|0  （暂存退回待审，从 hidden）
-- 注意：approved|public|1（已发布）**不允许**直接退回 — 必须先 unpublish 再退回（两步）。
--
-- 完整白名单（v1.3 053 后）：
--   pending_internal → pending_hidden | approved_public | approved_internal | rejected_hidden
--   pending_hidden   → pending_internal | approved_public | approved_internal | approved_hidden | rejected_hidden
--   approved_public  → approved_internal | approved_hidden
--   approved_internal→ approved_public | approved_hidden | **pending_internal** ← 新增
--   approved_hidden  → approved_public | approved_internal | **pending_hidden**  ← 新增
--   rejected_hidden  → pending_hidden | pending_internal
--
-- 测试集：tests/unit/db/migrations/053_state_machine_regression.test.ts 覆盖 18 条旧路径 + 2 条新路径。
--
-- ⚠️  Down 路径说明（项目约定）：
--   scripts/migrate.ts 将整个文件内容作为单条 SQL 执行，不区分 up/down 节。
--   down 路径必须保持注释形式；回滚需手动复制 down 节并恢复 034 trigger 实装。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION enforce_videos_state_machine()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_state text;
  new_state text;
BEGIN
  new_state := NEW.review_status || '|' || NEW.visibility_status || '|' ||
    CASE WHEN NEW.is_published THEN '1' ELSE '0' END;

  -- Soft-deleted rows are not part of serving path; skip strict checks.
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.review_status = 'pending_review' THEN
    IF NEW.is_published THEN
      RAISE EXCEPTION
        'invalid state: pending_review cannot be published (id=%)',
        COALESCE(NEW.id::text, 'new')
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.visibility_status = 'public' THEN
      RAISE EXCEPTION
        'invalid state: pending_review cannot be public (id=%)',
        COALESCE(NEW.id::text, 'new')
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF NEW.review_status = 'rejected' THEN
    IF NEW.visibility_status <> 'hidden' OR NEW.is_published THEN
      RAISE EXCEPTION
        'invalid state: rejected must be hidden + unpublished (id=%)',
        COALESCE(NEW.id::text, 'new')
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF NEW.review_status = 'approved' THEN
    IF NEW.is_published AND NEW.visibility_status <> 'public' THEN
      RAISE EXCEPTION
        'invalid state: published video must be approved + public (id=%)',
        COALESCE(NEW.id::text, 'new')
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.visibility_status = 'public' AND NOT NEW.is_published THEN
      RAISE EXCEPTION
        'invalid state: public video must be published (id=%)',
        COALESCE(NEW.id::text, 'new')
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    RAISE EXCEPTION
      'invalid review_status: % (id=%)',
      NEW.review_status,
      COALESCE(NEW.id::text, 'new')
      USING ERRCODE = 'check_violation';
  END IF;

  -- Transition whitelist check (UPDATE only).
  IF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL THEN
    old_state := OLD.review_status || '|' || OLD.visibility_status || '|' ||
      CASE WHEN OLD.is_published THEN '1' ELSE '0' END;

    IF old_state <> new_state THEN
      IF NOT (
        (old_state = 'pending_review|internal|0' AND new_state IN (
          'pending_review|hidden|0',
          'approved|public|1',
          'approved|internal|0',
          'rejected|hidden|0'
        ))
        OR
        (old_state = 'pending_review|hidden|0' AND new_state IN (
          'pending_review|internal|0',
          'approved|public|1',
          'approved|internal|0',
          'approved|hidden|0',
          'rejected|hidden|0'
        ))
        OR
        (old_state = 'approved|public|1' AND new_state IN ('approved|internal|0', 'approved|hidden|0'))
        OR
        -- 053 NEW: approved|internal|0 → pending_review|internal|0 (staging_revert)
        (old_state = 'approved|internal|0' AND new_state IN (
          'approved|public|1',
          'approved|hidden|0',
          'pending_review|internal|0'
        ))
        OR
        -- 053 NEW: approved|hidden|0 → pending_review|hidden|0 (staging_revert)
        (old_state = 'approved|hidden|0' AND new_state IN (
          'approved|public|1',
          'approved|internal|0',
          'pending_review|hidden|0'
        ))
        OR
        (old_state = 'rejected|hidden|0' AND new_state IN ('pending_review|hidden|0', 'pending_review|internal|0'))
      ) THEN
        RAISE EXCEPTION
          'invalid transition: % -> % (id=%)',
          old_state, new_state, COALESCE(NEW.id::text, 'new')
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  -- Ensure published videos always have at least one active source.
  IF NEW.is_published THEN
    PERFORM 1
    FROM video_sources s
    WHERE s.video_id = NEW.id
      AND s.deleted_at IS NULL
      AND s.is_active = true
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'invalid state: published video must have active source (id=%)',
        COALESCE(NEW.id::text, 'new')
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_videos_state_machine ON videos;

CREATE TRIGGER trg_videos_state_machine
BEFORE INSERT OR UPDATE OF review_status, visibility_status, is_published, deleted_at
ON videos
FOR EACH ROW
EXECUTE FUNCTION enforce_videos_state_machine();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'enforce_videos_state_machine'
  ) THEN
    RAISE EXCEPTION 'Migration 053: enforce_videos_state_machine function not found';
  END IF;
END $$;

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- 回滚到 034 trigger 实装（删除新增 2 条 staging_revert 转换）。
-- 回滚前必须先回滚 transitionVideoState.staging_revert 调用方（apps/api / apps/server-next）。
-- BEGIN;
-- -- 复制 034_fix_approve_hidden_to_internal.sql 的 enforce_videos_state_machine 函数体重建即可。
-- COMMIT;
