-- Migration 033: update state machine trigger to allow pending_review → approved+internal (staging)
--
-- CHG-384: CHG-382 changed the approve terminal state to approved+internal+false (staging),
-- but Migration 023's transition whitelist only allowed pending_review → approved+public+true.
-- This migration adds the two missing transitions:
--   pending_review|internal|0 → approved|internal|0
--   pending_review|hidden|0   → approved|hidden|0
--
-- Full updated whitelist:
--   pending_internal → pending_hidden | approved_public | approved_internal | rejected_hidden
--   pending_hidden   → pending_internal | approved_public | approved_hidden | rejected_hidden
--   approved_public  → approved_internal | approved_hidden
--   approved_internal→ approved_public | approved_hidden
--   approved_hidden  → approved_public | approved_internal
--   rejected_hidden  → pending_hidden | pending_internal

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
        -- pending_review|internal|0: 新增 approved|internal|0（暂存审核通过）
        (old_state = 'pending_review|internal|0' AND new_state IN (
          'pending_review|hidden|0',
          'approved|public|1',
          'approved|internal|0',
          'rejected|hidden|0'
        ))
        OR
        -- pending_review|hidden|0: 新增 approved|hidden|0（隐藏态审核通过后暂存）
        (old_state = 'pending_review|hidden|0' AND new_state IN (
          'pending_review|internal|0',
          'approved|public|1',
          'approved|hidden|0',
          'rejected|hidden|0'
        ))
        OR
        (old_state = 'approved|public|1' AND new_state IN ('approved|internal|0', 'approved|hidden|0'))
        OR
        (old_state = 'approved|internal|0' AND new_state IN ('approved|public|1', 'approved|hidden|0'))
        OR
        (old_state = 'approved|hidden|0' AND new_state IN ('approved|public|1', 'approved|internal|0'))
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

-- 触发器定义不变，替换函数体即可
DROP TRIGGER IF EXISTS trg_videos_state_machine ON videos;

CREATE TRIGGER trg_videos_state_machine
BEFORE INSERT OR UPDATE OF review_status, visibility_status, is_published, deleted_at
ON videos
FOR EACH ROW
EXECUTE FUNCTION enforce_videos_state_machine();

-- 验证：确认新触发器函数已创建
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'enforce_videos_state_machine'
  ) THEN
    RAISE EXCEPTION 'Migration 033: enforce_videos_state_machine function not found';
  END IF;
END $$;

COMMIT;
