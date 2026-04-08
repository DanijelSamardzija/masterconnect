/*
  # Fix Delete Account Function

  1. Changes
    - Remove auth.users deletion from function (must be done via admin API)
    - Function now only deletes/anonymizes user data
    - Returns success after cleaning up all data except auth.users
*/

-- Drop and recreate the function
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
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Ensure user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete posts
  DELETE FROM posts WHERE user_id = v_user_id;
  
  -- Delete comments
  DELETE FROM comments WHERE user_id = v_user_id;
  
  -- Delete post reactions
  DELETE FROM post_reactions WHERE user_id = v_user_id;
  
  -- Delete comment reactions
  DELETE FROM comment_reactions WHERE user_id = v_user_id;
  
  -- Delete notifications
  DELETE FROM notifications WHERE user_id = v_user_id;
  
  -- Delete blocks (both as blocker and blocked)
  DELETE FROM blocks WHERE blocker_id = v_user_id OR blocked_id = v_user_id;
  
  -- Delete thread participants
  DELETE FROM thread_participants WHERE user_id = v_user_id;
  
  -- Delete message reactions
  DELETE FROM message_reactions WHERE user_id = v_user_id;
  
  -- Delete reports (both as reporter and reported user)
  DELETE FROM reports WHERE reporter_id = v_user_id OR reported_user_id = v_user_id;
  
  -- Anonymize reviews written by this user
  UPDATE reviews 
  SET customer_id = NULL 
  WHERE customer_id = v_user_id;
  
  -- Delete reviews received by this user (if pro)
  DELETE FROM reviews WHERE pro_id = v_user_id;
  
  -- Anonymize messages sent by this user
  UPDATE messages 
  SET sender_id = NULL, is_deleted = true 
  WHERE sender_id = v_user_id;
  
  -- Delete jobs posted by this user
  DELETE FROM jobs WHERE customer_id = v_user_id;
  
  -- Delete profile
  DELETE FROM profiles WHERE id = v_user_id;
  
  RETURN json_build_object('success', true, 'user_id', v_user_id);
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to delete account: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;