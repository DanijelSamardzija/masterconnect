/*
  # Fix Auto-create Profile Trigger for Account Type Structure

  1. Changes
    - Update trigger function to use account_type instead of active_role/roles
    - Map CUSTOMER -> 'customer', PRO -> 'professional'
    - Remove references to deprecated columns

  2. Security
    - Maintains SECURITY DEFINER for bypass RLS
    - Properly handles metadata extraction
*/

-- Drop existing function and trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create updated function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_role text;
  user_name text;
  account_type_value text;
BEGIN
  -- Extract metadata
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'User');
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'CUSTOMER');
  
  -- Map role to account_type
  IF user_role = 'PRO' THEN
    account_type_value := 'professional';
  ELSE
    account_type_value := 'customer';
  END IF;

  -- Insert profile
  INSERT INTO public.profiles (id, name, email, role, account_type, created_at)
  VALUES (
    NEW.id,
    user_name,
    NEW.email,
    user_role,
    account_type_value,
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

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
