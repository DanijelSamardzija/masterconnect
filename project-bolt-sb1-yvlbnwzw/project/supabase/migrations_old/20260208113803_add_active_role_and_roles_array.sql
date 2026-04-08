/*
  # Add Role Switching Support

  1. New Fields
    - `roles` (jsonb array) - Stores all roles a user has (e.g., ["customer", "pro"])
    - `active_role` (text) - The currently active role ("customer" or "pro")

  2. Data Migration
    - Convert existing single `role` field to `roles` array
    - Set default active_role based on user's roles (pro if available, else customer)
    - Keep existing `role` field for backward compatibility

  3. Important Notes
    - Users can have multiple roles (both customer and pro)
    - active_role determines what permissions/views they see
    - Default active_role is "pro" if user has pro role, otherwise "customer"
*/

-- Add roles array field (stores all roles user has)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'roles'
  ) THEN
    ALTER TABLE profiles ADD COLUMN roles jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add active_role field (currently active role)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'active_role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN active_role text;
  END IF;
END $$;

-- Migrate existing data: convert role to roles array
UPDATE profiles
SET roles = 
  CASE 
    WHEN role = 'PRO' THEN '["pro"]'::jsonb
    WHEN role = 'CUSTOMER' THEN '["customer"]'::jsonb
    ELSE '["customer"]'::jsonb
  END
WHERE roles = '[]'::jsonb OR roles IS NULL;

-- Set active_role based on roles array
UPDATE profiles
SET active_role = 
  CASE 
    WHEN roles ? 'pro' THEN 'pro'
    ELSE 'customer'
  END
WHERE active_role IS NULL;

-- Set default value for new profiles
ALTER TABLE profiles ALTER COLUMN active_role SET DEFAULT 'customer';

-- Create index for faster role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_active_role ON profiles(active_role);
CREATE INDEX IF NOT EXISTS idx_profiles_roles ON profiles USING gin(roles);