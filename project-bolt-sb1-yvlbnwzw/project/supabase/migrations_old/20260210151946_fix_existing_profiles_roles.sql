/*
  # Fix existing profiles roles array

  1. Changes
    - Updates all profiles to have proper roles array based on their role field
    - Sets active_role based on role field if it's not already set
    - Ensures all profiles have at least one role in the roles array

  2. Details
    - PRO users get ["pro"] in roles array and "pro" as active_role
    - CUSTOMER users get ["customer"] in roles array and "customer" as active_role
*/

-- Update all profiles to have proper roles array
UPDATE profiles
SET 
  roles = CASE 
    WHEN role = 'PRO' THEN '["pro"]'::jsonb
    ELSE '["customer"]'::jsonb
  END,
  active_role = CASE 
    WHEN role = 'PRO' THEN 'pro'
    ELSE 'customer'
  END
WHERE roles = '[]'::jsonb OR roles IS NULL OR active_role IS NULL;
