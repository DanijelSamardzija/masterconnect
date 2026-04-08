/*
  # Remove old reset_deleted_at trigger

  1. Purpose
    - Remove duplicate trigger that was handling deleted_at reset
    - New unified trigger now handles this functionality
    
  2. Changes
    - Drop trigger_reset_deleted_at_for_receiver
    - Drop reset_deleted_at_for_receiver function
*/

-- Drop old trigger and function
DROP TRIGGER IF EXISTS trigger_reset_deleted_at_for_receiver ON messages;
DROP FUNCTION IF EXISTS reset_deleted_at_for_receiver();