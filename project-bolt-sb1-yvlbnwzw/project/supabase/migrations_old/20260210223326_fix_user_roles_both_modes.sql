/*
  # Fix user roles to allow switching between Customer and Pro modes

  1. Changes
    - Updates the handle_new_user() function to give all users both 'customer' and 'pro' roles
    - This allows any user to switch between modes regardless of how they signed up
    - The active_role is still set based on their registration choice
    - Existing users are updated to have both roles if they only have one

  2. Rationale
    - Professionals may want to hire other professionals
    - Customers may want to offer services themselves
    - Provides flexibility without requiring separate accounts
*/

-- Update the function to give all users both roles
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
  
  -- Set active_role based on registration choice
  IF user_role = 'PRO' THEN
    active_role_value := 'pro';
  ELSE
    active_role_value := 'customer';
  END IF;

  -- All users get both roles for flexibility
  roles_array := '["customer", "pro"]'::jsonb;

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

-- Update existing users to have both roles if they don't already
UPDATE profiles
SET roles = '["customer", "pro"]'::jsonb
WHERE jsonb_array_length(roles) < 2;