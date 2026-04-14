/*
  Admin version of delete_user_account().
  Can be called with service_role key to delete any user's data.
  Cleans up all tables in safe dependency order.
*/

CREATE OR REPLACE FUNCTION admin_delete_user_account(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Comment reactions (before comments)
  DELETE FROM comment_reactions WHERE user_id = target_user_id;

  -- Post comments
  DELETE FROM post_comments WHERE user_id = target_user_id;

  -- Post reactions
  DELETE FROM post_reactions WHERE user_id = target_user_id;

  -- Posts + media
  DELETE FROM post_media WHERE post_id IN (SELECT id FROM posts WHERE user_id = target_user_id);
  DELETE FROM posts WHERE user_id = target_user_id;

  -- Message reactions
  DELETE FROM message_reactions WHERE user_id = target_user_id;

  -- Soft-delete messages sent by user
  UPDATE messages SET sender_id = NULL, is_deleted = true WHERE sender_id = target_user_id;

  -- Thread participants
  DELETE FROM thread_participants WHERE user_id = target_user_id;

  -- Notifications
  DELETE FROM notifications WHERE user_id = target_user_id OR actor_id = target_user_id;

  -- Blocks
  DELETE FROM blocks WHERE blocker_user_id = target_user_id OR blocked_user_id = target_user_id;

  -- Reports
  DELETE FROM reports WHERE reporter_user_id = target_user_id OR target_owner_user_id = target_user_id;

  -- Saved posts
  DELETE FROM saved_posts WHERE user_id = target_user_id;

  -- Followers
  DELETE FROM followers WHERE follower_id = target_user_id OR following_id = target_user_id;

  -- Reviews: anonymize written, delete received
  UPDATE reviews SET customer_id = NULL WHERE customer_id = target_user_id;
  DELETE FROM reviews WHERE pro_id = target_user_id;

  -- Offers
  DELETE FROM offers WHERE sender_id = target_user_id OR receiver_id = target_user_id;

  -- Jobs
  DELETE FROM jobs WHERE customer_id = target_user_id;

  -- Job applications
  DELETE FROM job_applications WHERE applicant_id = target_user_id;

  -- Pro profile
  DELETE FROM pro_profiles WHERE id = target_user_id;

  -- Push subscriptions
  DELETE FROM push_subscriptions WHERE user_id = target_user_id;

  -- Profile views
  DELETE FROM profile_views WHERE viewer_id = target_user_id OR profile_id = target_user_id;

  -- Main profile (last)
  DELETE FROM profiles WHERE id = target_user_id;

  RETURN json_build_object('success', true, 'user_id', target_user_id);

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to delete user %: %', target_user_id, SQLERRM;
END;
$$;

-- Only service_role can call this (not regular authenticated users)
REVOKE EXECUTE ON FUNCTION admin_delete_user_account(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION admin_delete_user_account(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_user_account(uuid) TO service_role;
