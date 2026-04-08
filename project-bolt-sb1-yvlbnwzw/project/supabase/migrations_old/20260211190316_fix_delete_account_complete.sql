/*
  # Fix Delete Account Function and Add Missing Policies - Complete Fix

  1. Changes
    - Fix ALL column names to match actual table structures
    - Add missing DELETE policies for: notifications, thread_participants, reports, reviews, jobs
    - Add UPDATE policy for reviews (anonymization)
*/

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can delete own jobs" ON jobs;
  DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
  DROP POLICY IF EXISTS "Users can delete own reports" ON reports;
  DROP POLICY IF EXISTS "Users can delete reviews they wrote" ON reviews;
  DROP POLICY IF EXISTS "Users can delete reviews they received" ON reviews;
  DROP POLICY IF EXISTS "Users can delete own thread participation" ON thread_participants;
  DROP POLICY IF EXISTS "Users can anonymize reviews they wrote" ON reviews;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Add missing DELETE policies

CREATE POLICY "Users can delete own jobs"
  ON jobs FOR DELETE
  TO authenticated
  USING (auth.uid() = customer_id);

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reports"
  ON reports FOR DELETE
  TO authenticated
  USING (auth.uid() = reporter_user_id);

CREATE POLICY "Users can delete reviews they wrote"
  ON reviews FOR DELETE
  TO authenticated
  USING (auth.uid() = customer_id);

CREATE POLICY "Users can delete reviews they received"
  ON reviews FOR DELETE
  TO authenticated
  USING (auth.uid() = pro_id);

CREATE POLICY "Users can delete own thread participation"
  ON thread_participants FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add UPDATE policy for reviews (for anonymization)
CREATE POLICY "Users can anonymize reviews they wrote"
  ON reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = customer_id)
  WITH CHECK (customer_id IS NULL);

-- Fix the delete_user_account function with correct column names
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
  DELETE FROM post_comments WHERE user_id = v_user_id;
  
  -- Delete post reactions
  DELETE FROM post_reactions WHERE user_id = v_user_id;
  
  -- Delete comment reactions
  DELETE FROM comment_reactions WHERE user_id = v_user_id;
  
  -- Delete notifications
  DELETE FROM notifications WHERE user_id = v_user_id;
  
  -- Delete blocks (both as blocker and blocked)
  DELETE FROM blocks WHERE blocker_user_id = v_user_id OR blocked_user_id = v_user_id;
  
  -- Delete thread participants
  DELETE FROM thread_participants WHERE user_id = v_user_id;
  
  -- Delete message reactions
  DELETE FROM message_reactions WHERE user_id = v_user_id;
  
  -- Delete reports (both as reporter and target owner)
  DELETE FROM reports WHERE reporter_user_id = v_user_id OR target_owner_user_id = v_user_id;
  
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
