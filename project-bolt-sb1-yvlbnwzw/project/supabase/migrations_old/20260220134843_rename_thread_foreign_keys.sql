/*
  # Rename thread foreign key constraints

  1. Changes
    - Rename `threads_customer_id_fkey` to `threads_user1_id_fkey`
    - Rename `threads_pro_id_fkey` to `threads_user2_id_fkey`
    
  2. Purpose
    - Update foreign key names to match new column names
    - Maintain referential integrity
*/

-- Rename foreign key constraints to match new column names
ALTER TABLE threads 
  RENAME CONSTRAINT threads_customer_id_fkey TO threads_user1_id_fkey;

ALTER TABLE threads 
  RENAME CONSTRAINT threads_pro_id_fkey TO threads_user2_id_fkey;
