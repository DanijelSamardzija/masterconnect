-- Sprint A: Update get_unread_count to exclude system messages (consistent with nav filter)
CREATE OR REPLACE FUNCTION get_unread_count()
RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(COUNT(m.id), 0)
  FROM thread_participants tp
  JOIN messages m
    ON m.thread_id   = tp.thread_id
   AND m.sender_id  != auth.uid()
   AND m.is_deleted  = false
   AND m.is_system   = false
   AND m.created_at  > COALESCE(tp.last_read_at, '1970-01-01'::timestamptz)
  WHERE tp.user_id    = auth.uid()
    AND tp.deleted_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION get_unread_count() TO authenticated;

-- Sprint A: Server-side pro rating aggregation.
-- Prevents client from writing arbitrary values to profiles.average_rating.
-- Any authenticated caller triggers a real COUNT/AVG from the reviews table —
-- the result is always mathematically correct regardless of who calls it.
CREATE OR REPLACE FUNCTION update_pro_rating(target_pro_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  avg_r  numeric;
  cnt    bigint;
BEGIN
  SELECT
    ROUND(AVG(rating)::numeric, 2),
    COUNT(*)
  INTO avg_r, cnt
  FROM reviews
  WHERE pro_id = target_pro_id;

  UPDATE profiles
  SET
    average_rating = COALESCE(avg_r, 0),
    review_count   = COALESCE(cnt, 0)
  WHERE id = target_pro_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_pro_rating(uuid) TO authenticated;
