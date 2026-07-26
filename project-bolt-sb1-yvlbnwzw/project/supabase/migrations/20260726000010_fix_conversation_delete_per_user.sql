-- Fix per-user conversation deletion (WhatsApp model)
--
-- Bug 1: After both users delete and one re-messages, receiver sees full history.
--   Root cause: trigger reset deleted_at=NULL without ensuring hidden_before was set,
--   so old rows without hidden_before had no message cutoff after reset.
--   Fix: capture hidden_before = COALESCE(hidden_before, deleted_at) before resetting deleted_at.
--
-- Bug 2: When Zoran deletes, the thread disappears from Danijel's list too.
--   Root cause: get_thread_list JOINed other participant with op.deleted_at IS NULL,
--   so Zoran's deletion caused the JOIN to fail for Danijel's query.
--   Fix: remove op.deleted_at IS NULL from JOIN; each user's visibility is independent.

-- ── 1. Trigger: preserve history cutoff before restoring conversation ────────

CREATE OR REPLACE FUNCTION reset_thread_deleted_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE thread_participants
  SET
    hidden_before = COALESCE(hidden_before, deleted_at),
    deleted_at    = NULL
  WHERE thread_id     = NEW.thread_id
    AND deleted_at IS NOT NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger already exists — replace function body only, no need to recreate trigger.

-- ── 2. get_thread_list: per-user visibility, hidden_before-aware ─────────────

CREATE OR REPLACE FUNCTION get_thread_list()
RETURNS TABLE (
  thread_id       uuid,
  thread_type     text,
  other_user_id   uuid,
  other_name      text,
  other_avatar    text,
  other_last_seen timestamptz,
  last_message    text,
  last_message_at timestamptz,
  unread_count    bigint
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    tp.thread_id,
    t.thread_type,
    op.user_id                    AS other_user_id,
    pr.name                       AS other_name,
    pr.avatar_url                 AS other_avatar,
    pr.last_seen                  AS other_last_seen,
    lm.text                       AS last_message,
    lm.created_at                 AS last_message_at,
    COUNT(um.id)                  AS unread_count
  FROM thread_participants tp
  JOIN threads t
    ON t.id         = tp.thread_id
  -- Other participant: no deleted_at filter — each user's deletion is independent
  JOIN thread_participants op
    ON op.thread_id = tp.thread_id
   AND op.user_id  != auth.uid()
  JOIN profiles pr
    ON pr.id        = op.user_id
  -- Last visible message for current user (respects hidden_before)
  LEFT JOIN LATERAL (
    SELECT text, created_at
    FROM   messages
    WHERE  thread_id  = tp.thread_id
      AND  is_deleted = false
      AND  created_at > COALESCE(tp.hidden_before, '1970-01-01'::timestamptz)
    ORDER  BY created_at DESC
    LIMIT  1
  ) lm ON true
  -- Unread messages: after last_read_at AND after hidden_before
  LEFT JOIN messages um
    ON um.thread_id  = tp.thread_id
   AND um.sender_id != auth.uid()
   AND um.is_deleted = false
   AND um.created_at > COALESCE(tp.last_read_at,  '1970-01-01'::timestamptz)
   AND um.created_at > COALESCE(tp.hidden_before, '1970-01-01'::timestamptz)
  WHERE tp.user_id    = auth.uid()
    AND tp.deleted_at IS NULL
    AND t.thread_type NOT IN ('adult_inquiry')
  GROUP BY
    tp.thread_id, t.thread_type,
    op.user_id, pr.name, pr.avatar_url, pr.last_seen,
    lm.text, lm.created_at
  ORDER BY lm.created_at DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION get_thread_list() TO authenticated;
