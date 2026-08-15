-- Fix delete_user_account: add p_reason/p_comment params (API passes these),
-- sync cleanup scope with admin_delete_user_account (threads, credits,
-- push_subscriptions, profile_views, job_applications).

DROP FUNCTION IF EXISTS delete_user_account();
DROP FUNCTION IF EXISTS delete_user_account(text, text);

CREATE OR REPLACE FUNCTION delete_user_account(
  p_reason  text DEFAULT NULL,
  p_comment text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Failed to delete account: Not authenticated';
  END IF;

  -- Comment reactions (before comments)
  DELETE FROM comment_reactions WHERE user_id = v_user_id;

  -- Post comments
  DELETE FROM post_comments WHERE user_id = v_user_id;

  -- Post reactions
  DELETE FROM post_reactions WHERE user_id = v_user_id;

  -- Posts + media
  DELETE FROM post_media WHERE post_id IN (SELECT id FROM posts WHERE user_id = v_user_id);
  DELETE FROM posts WHERE user_id = v_user_id;

  -- Message reactions
  DELETE FROM message_reactions WHERE user_id = v_user_id;

  -- Delete messages (sender_id is NOT NULL, cannot soft-delete)
  DELETE FROM messages WHERE sender_id = v_user_id OR receiver_id = v_user_id;

  -- Thread participants (removes user from all threads)
  DELETE FROM thread_participants WHERE user_id = v_user_id;

  -- Threads where this user is user1 or user2 and no other participant remains
  DELETE FROM threads
  WHERE (user1_id = v_user_id OR user2_id = v_user_id)
    AND id NOT IN (SELECT thread_id FROM thread_participants);

  -- Notifications
  DELETE FROM notifications WHERE user_id = v_user_id;

  -- Blocks (both sides)
  DELETE FROM blocks WHERE blocker_user_id = v_user_id OR blocked_user_id = v_user_id;

  -- Reports (both sides)
  DELETE FROM reports WHERE reporter_user_id = v_user_id OR target_owner_user_id = v_user_id;

  -- Saved posts
  DELETE FROM saved_posts WHERE user_id = v_user_id;

  -- Followers (both sides)
  DELETE FROM followers WHERE follower_id = v_user_id OR following_id = v_user_id;

  -- Reviews: anonymize written, delete received
  UPDATE reviews SET customer_id = NULL WHERE customer_id = v_user_id;
  DELETE FROM reviews WHERE pro_id = v_user_id;

  -- Offers
  DELETE FROM offers WHERE sender_id = v_user_id OR receiver_id = v_user_id;

  -- Job applications
  DELETE FROM job_applications WHERE applicant_id = v_user_id;

  -- Jobs posted by this user
  DELETE FROM jobs WHERE customer_id = v_user_id;

  -- Pro profile
  DELETE FROM pro_profiles WHERE id = v_user_id;

  -- Push subscriptions
  DELETE FROM push_subscriptions WHERE user_id = v_user_id;

  -- Profile views
  DELETE FROM profile_views WHERE viewer_id = v_user_id OR profile_id = v_user_id;

  -- Credits
  DELETE FROM credit_transactions WHERE user_id = v_user_id;
  DELETE FROM credits_balance WHERE user_id = v_user_id;

  -- Main profile (last — FK root)
  DELETE FROM profiles WHERE id = v_user_id;

  RETURN json_build_object('success', true, 'user_id', v_user_id);

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to delete account: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_user_account(text, text) TO authenticated;
