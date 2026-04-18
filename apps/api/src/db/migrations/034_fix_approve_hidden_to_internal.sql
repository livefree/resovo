-- Migration 034: allow pending_review|hidden|0 → approved|internal|0 (approve-to-staging for hidden videos)
--
-- CHG-389: Migration 033 added pending_review|hidden|0 → approved|hidden|0 (keeps hidden),
-- but transitionVideoState.approve always sets nextVisibility = 'internal' regardless of current state.
-- This means approving a hidden-state pending video fails with DB trigger violation.
-- Hidden pending videos arise when: rejected → reopen_pending (sets pending_review+hidden).
-- Fix: add pending_review|hidden|0 → approved|internal|0 to the whitelist so
-- approve always moves to staging (internal+false) regardless of prior visibility.
--
-- Updated whitelist (full):
--   pending_internal → pending_hidden | approved_public | approved_internal | rejected_hidden
--   pending_hidden   → pending_internal | approved_public | approved_internal | approved_hidden | rejected_hidden
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
        (old_state = 'pending_review|internal|0' AND new_state IN (
          'pending_review|hidden|0',
          'approved|public|1',
          'approved|internal|0',
          'rejected|hidden|0'
        ))
        OR
        -- pending_hidden: approve always goes to staging (internal), not stays hidden
        (old_state = 'pending_review|hidden|0' AND new_state IN (
          'pending_review|internal|0',
          'approved|public|1',
          'approved|internal|0',   -- NEW (034): approve hidden → staging
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
    RAISE EXCEPTION 'Migration 034: enforce_videos_state_machine function not found';
  END IF;
END $$;

COMMIT;
