/*
  # Delete Account Function

  Creates the delete_user_account() RPC function that cleans up
  all user data before the auth user is removed via the admin API.

  Tables handled (in safe dependency order):
    - comment_reactions
    - post_comments
    - post_reactions
    - post_media (cascade from posts)
    - posts
    - message_reactions
    - messages (soft-delete sender)
    - thread_participants
    - notifications
    - blocks
    - reports
    - saved_posts
    - followers
    - reviews (anonymize written / delete received)
    - offers
    - jobs
    - pro_profiles
    - profiles  ← last (FK root)

  Returns: json { success: true, user_id: uuid }
*/

DROP FUNCTION IF EXISTS delete_user_account();

CREATE OR REPLACE FUNCTION delete_user_account()
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
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Comment reactions (before comments)
  DELETE FROM comment_reactions WHERE user_id = v_user_id;

  -- Post comments
  DELETE FROM post_comments WHERE user_id = v_user_id;

  -- Post reactions
  DELETE FROM post_reactions WHERE user_id = v_user_id;

  -- Posts (cascades post_media via ON DELETE CASCADE if set, else explicit)
  DELETE FROM post_media WHERE post_id IN (SELECT id FROM posts WHERE user_id = v_user_id);
  DELETE FROM posts WHERE user_id = v_user_id;

  -- Message reactions
  DELETE FROM message_reactions WHERE user_id = v_user_id;

  -- Soft-delete messages sent by user (keep thread structure intact)
  UPDATE messages
  SET sender_id = NULL, is_deleted = true
  WHERE sender_id = v_user_id;

  -- Thread participants
  DELETE FROM thread_participants WHERE user_id = v_user_id;

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

  -- Reviews: anonymize ones user wrote, delete ones user received (as pro)
  UPDATE reviews SET customer_id = NULL WHERE customer_id = v_user_id;
  DELETE FROM reviews WHERE pro_id = v_user_id;

  -- Offers
  DELETE FROM offers WHERE sender_id = v_user_id OR receiver_id = v_user_id;

  -- Jobs posted by this user
  DELETE FROM jobs WHERE customer_id = v_user_id;

  -- Pro profile
  DELETE FROM pro_profiles WHERE id = v_user_id;

  -- Main profile (last — FK root)
  DELETE FROM profiles WHERE id = v_user_id;

  RETURN json_build_object('success', true, 'user_id', v_user_id);

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to delete account: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;
