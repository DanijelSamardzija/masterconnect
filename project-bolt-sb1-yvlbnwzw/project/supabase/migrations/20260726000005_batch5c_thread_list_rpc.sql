-- Batch 5C: get_thread_list RPC
-- Replaces the N+1 pattern in fetchThreads (2 + N×3 queries → 1 query).
--
-- Security: uses auth.uid() directly — no user_id parameter to spoof.
-- Excluded: 'adult_inquiry' threads (belong to the Adult module, shown separately).

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
    ON t.id             = tp.thread_id
  -- Other participant (not current user, not deleted from thread)
  JOIN thread_participants op
    ON op.thread_id     = tp.thread_id
   AND op.user_id      != auth.uid()
   AND op.deleted_at   IS NULL
  JOIN profiles pr
    ON pr.id            = op.user_id
  -- Last non-deleted message in thread (LATERAL for efficiency)
  LEFT JOIN LATERAL (
    SELECT text, created_at
    FROM   messages
    WHERE  thread_id  = tp.thread_id
      AND  is_deleted = false
    ORDER  BY created_at DESC
    LIMIT  1
  ) lm ON true
  -- Unread messages: sent by others, not deleted, after last_read_at
  LEFT JOIN messages um
    ON um.thread_id   = tp.thread_id
   AND um.sender_id  != auth.uid()
   AND um.is_deleted  = false
   AND um.created_at  > COALESCE(tp.last_read_at, '1970-01-01'::timestamptz)
  WHERE tp.user_id    = auth.uid()
    AND tp.deleted_at IS NULL
    AND t.thread_type NOT IN ('adult_inquiry')
  GROUP BY
    tp.thread_id,
    t.thread_type,
    op.user_id,
    pr.name,
    pr.avatar_url,
    pr.last_seen,
    lm.text,
    lm.created_at
  ORDER BY lm.created_at DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION get_thread_list() TO authenticated;
