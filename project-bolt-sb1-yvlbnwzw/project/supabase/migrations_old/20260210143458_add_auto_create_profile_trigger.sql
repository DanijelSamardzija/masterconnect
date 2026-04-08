/*
  # Auto-create profile on user signup

  1. Changes
    - Creates a trigger function that automatically creates a profile when a new user signs up
    - This ensures the profile is created immediately after auth.users record is created
    - Extracts user data from raw_user_meta_data (name, role)
    - Sets up proper roles array and active_role based on the selected role

  2. Security
    - Function runs with SECURITY DEFINER to bypass RLS
    - Only triggered on INSERT to auth.users table
    - Safely handles missing metadata fields with COALESCE
*/

-- Create function to auto-create profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_role text;
  user_name text;
  active_role_value text;
  roles_array jsonb;
BEGIN
  -- Extract metadata
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'User');
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'CUSTOMER');
  
  -- Set active_role and roles array based on user_role
  IF user_role = 'PRO' THEN
    active_role_value := 'pro';
    roles_array := '["pro"]'::jsonb;
  ELSE
    active_role_value := 'customer';
    roles_array := '["customer"]'::jsonb;
  END IF;

  -- Insert profile
  INSERT INTO public.profiles (id, name, email, role, active_role, roles, created_at)
  VALUES (
    NEW.id,
    user_name,
    NEW.email,
    user_role,
    active_role_value,
    roles_array,
    NOW()
  );

  -- If PRO, also create pro_profile
  IF user_role = 'PRO' THEN
    INSERT INTO public.pro_profiles (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
