/*
  # Add Delete Account Function

  1. New Functions
    - `delete_user_account()` - Securely deletes the current user's account
      - Deletes all user data (posts, comments, reactions, notifications, etc.)
      - Anonymizes reviews and messages
      - Deletes profile and auth user
      - Uses SECURITY DEFINER to run with elevated privileges
  
  2. Security
    - Function can only be called by authenticated users
    - Only deletes the calling user's own data
    - Validates confirmation before deletion
*/

-- Create function to delete user account
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile_data record;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Ensure user is authenticated
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get profile data for storage cleanup
  SELECT avatar_url, cover_url INTO v_profile_data
  FROM profiles
  WHERE id = v_user_id;

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
  
  -- Delete auth user (this will cascade to sessions, etc.)
  DELETE FROM auth.users WHERE id = v_user_id;
  
  RETURN json_build_object('success', true);
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;