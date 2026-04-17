-- Migration 023: enforce videos state machine with trigger
-- Goal:
-- 1) remediate existing invalid triples(review_status, visibility_status, is_published)
-- 2) prevent future invalid writes at DB layer
--
-- State machine (allowed):
-- pending_review -> (internal,false) | (hidden,false)
-- approved       -> (public,true) | (internal,false) | (hidden,false)
-- rejected       -> (hidden,false)
--
-- Transition whitelist (OLD -> NEW):
-- pending_internal -> pending_hidden | approved_public | rejected_hidden
-- pending_hidden   -> pending_internal | approved_public | rejected_hidden
-- approved_public  -> approved_internal | approved_hidden
-- approved_internal-> approved_public | approved_hidden
-- approved_hidden  -> approved_public | approved_internal
-- rejected_hidden  -> pending_hidden | pending_internal

BEGIN;

-- ── Step 1: one-time remediation (conservative, no auto-exposure) ──────────

-- Rejected must be hidden + unpublished.
UPDATE videos
SET visibility_status = 'hidden',
    is_published = false,
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND review_status = 'rejected'
  AND (visibility_status <> 'hidden' OR is_published <> false);

-- Pending review cannot be published/public.
UPDATE videos
SET visibility_status = CASE
      WHEN visibility_status = 'public' THEN 'internal'
      ELSE visibility_status
    END,
    is_published = false,
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND review_status = 'pending_review'
  AND (is_published <> false OR visibility_status = 'public');

-- Approved + public + unpublished => keep unpublished, downgrade visibility to internal.
UPDATE videos
SET visibility_status = 'internal',
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND review_status = 'approved'
  AND visibility_status = 'public'
  AND is_published = false;

-- Approved + (internal|hidden) cannot be published.
UPDATE videos
SET is_published = false,
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND review_status = 'approved'
  AND visibility_status IN ('internal', 'hidden')
  AND is_published = true;

-- ── Step 2: trigger function ───────────────────────────────────────────────

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
    -- review_status already has CHECK, this is defensive.
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
        (old_state = 'pending_review|internal|0' AND new_state IN ('pending_review|hidden|0', 'approved|public|1', 'rejected|hidden|0'))
        OR
        (old_state = 'pending_review|hidden|0' AND new_state IN ('pending_review|internal|0', 'approved|public|1', 'rejected|hidden|0'))
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

-- ── Reconcile + watchdog ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS video_state_watchdog_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  detected_count INTEGER NOT NULL,
  fixed_count INTEGER NOT NULL DEFAULT 0,
  sample JSONB,
  auto_fix BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION run_video_state_watchdog(auto_fix boolean DEFAULT false)
RETURNS TABLE(detected_count integer, fixed_count integer)
LANGUAGE plpgsql
AS $$
DECLARE
  detected integer := 0;
  fixed integer := 0;
  sample_rows jsonb := '[]'::jsonb;
BEGIN
  PERFORM set_config('lock_timeout', '3s', true);
  PERFORM set_config('statement_timeout', '15s', true);

  SELECT COUNT(*)
  INTO detected
  FROM videos v
  WHERE v.deleted_at IS NULL
    AND (
      (v.review_status = 'pending_review' AND (v.is_published = true OR v.visibility_status = 'public'))
      OR (v.review_status = 'rejected' AND (v.visibility_status <> 'hidden' OR v.is_published = true))
      OR (v.review_status = 'approved' AND (
            (v.visibility_status = 'public' AND v.is_published = false)
            OR (v.visibility_status IN ('internal', 'hidden') AND v.is_published = true)
          ))
      OR (v.is_published = true AND NOT EXISTS (
            SELECT 1 FROM video_sources s
            WHERE s.video_id = v.id AND s.deleted_at IS NULL AND s.is_active = true
          ))
    );

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', x.id,
        'review_status', x.review_status,
        'visibility_status', x.visibility_status,
        'is_published', x.is_published
      )
    ),
    '[]'::jsonb
  )
  INTO sample_rows
  FROM (
    SELECT v.id, v.review_status, v.visibility_status, v.is_published
    FROM videos v
    WHERE v.deleted_at IS NULL
      AND (
        (v.review_status = 'pending_review' AND (v.is_published = true OR v.visibility_status = 'public'))
        OR (v.review_status = 'rejected' AND (v.visibility_status <> 'hidden' OR v.is_published = true))
        OR (v.review_status = 'approved' AND (
              (v.visibility_status = 'public' AND v.is_published = false)
              OR (v.visibility_status IN ('internal', 'hidden') AND v.is_published = true)
            ))
        OR (v.is_published = true AND NOT EXISTS (
              SELECT 1 FROM video_sources s
              WHERE s.video_id = v.id AND s.deleted_at IS NULL AND s.is_active = true
            ))
      )
    ORDER BY v.updated_at DESC
    LIMIT 50
  ) x;

  IF auto_fix THEN
    -- Rejected -> hidden + unpublished
    WITH fixed_rows AS (
      UPDATE videos
      SET visibility_status = 'hidden',
          is_published = false,
          updated_at = NOW()
      WHERE deleted_at IS NULL
        AND review_status = 'rejected'
        AND (visibility_status <> 'hidden' OR is_published = true)
      RETURNING id
    )
    SELECT fixed + COUNT(*) INTO fixed FROM fixed_rows;

    -- Pending -> not published + non-public
    WITH fixed_rows AS (
      UPDATE videos
      SET visibility_status = CASE WHEN visibility_status = 'public' THEN 'internal' ELSE visibility_status END,
          is_published = false,
          updated_at = NOW()
      WHERE deleted_at IS NULL
        AND review_status = 'pending_review'
        AND (is_published = true OR visibility_status = 'public')
      RETURNING id
    )
    SELECT fixed + COUNT(*) INTO fixed FROM fixed_rows;

    -- Approved + public+false -> internal+false (no auto exposure)
    WITH fixed_rows AS (
      UPDATE videos
      SET visibility_status = 'internal',
          updated_at = NOW()
      WHERE deleted_at IS NULL
        AND review_status = 'approved'
        AND visibility_status = 'public'
        AND is_published = false
      RETURNING id
    )
    SELECT fixed + COUNT(*) INTO fixed FROM fixed_rows;

    -- Approved + internal/hidden + true -> unpublished
    WITH fixed_rows AS (
      UPDATE videos
      SET is_published = false,
          updated_at = NOW()
      WHERE deleted_at IS NULL
        AND review_status = 'approved'
        AND visibility_status IN ('internal', 'hidden')
        AND is_published = true
      RETURNING id
    )
    SELECT fixed + COUNT(*) INTO fixed FROM fixed_rows;

    -- Published without active source -> unpublish and internal (approved), otherwise keep visibility but unpublish
    WITH fixed_rows AS (
      UPDATE videos v
      SET is_published = false,
          visibility_status = CASE
            WHEN v.review_status = 'approved' AND v.visibility_status = 'public' THEN 'internal'
            ELSE v.visibility_status
          END,
          updated_at = NOW()
      WHERE v.deleted_at IS NULL
        AND v.is_published = true
        AND NOT EXISTS (
          SELECT 1 FROM video_sources s
          WHERE s.video_id = v.id AND s.deleted_at IS NULL AND s.is_active = true
        )
      RETURNING v.id
    )
    SELECT fixed + COUNT(*) INTO fixed FROM fixed_rows;
  END IF;

  INSERT INTO video_state_watchdog_runs(detected_count, fixed_count, sample, auto_fix)
  VALUES (detected, fixed, sample_rows, auto_fix);

  RETURN QUERY SELECT detected, fixed;
END;
$$;

COMMIT;
