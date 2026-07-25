-- Batch 6B: get_unread_count() RPC
-- Replaces the N+1 sequential for-loop in dashboard/page.tsx fetchUnreadCount.
--
-- Before: 1 query for thread_participants + 1 COUNT per thread (sequential await)
--         User with 50 threads → 51 sequential DB round-trips.
-- After:  1 JOIN query, regardless of thread count.
--
-- Security: auth.uid() directly — no user_id parameter to spoof.
-- Consistent with get_thread_list(): filters is_deleted = false.

CREATE OR REPLACE FUNCTION get_unread_count()
RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(COUNT(m.id), 0)
  FROM thread_participants tp
  JOIN messages m
    ON m.thread_id   = tp.thread_id
   AND m.sender_id  != auth.uid()
   AND m.is_deleted  = false
   AND m.created_at  > COALESCE(tp.last_read_at, '1970-01-01'::timestamptz)
  WHERE tp.user_id    = auth.uid()
    AND tp.deleted_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION get_unread_count() TO authenticated;
