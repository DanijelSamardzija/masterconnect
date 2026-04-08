/*
  # Update Profile Trigger to Include City and Category

  1. Changes
    - Update handle_new_user() trigger function to extract city and category from metadata
    - Set city and category in profiles table on user registration
    - Maintain backward compatibility if fields are not provided

  2. Security
    - Maintains SECURITY DEFINER for bypass RLS
    - Properly handles metadata extraction
*/

-- Drop existing function and trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create updated function with city and category support
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_role text;
  user_name text;
  user_city text;
  user_category text;
  account_type_value text;
BEGIN
  -- Extract metadata
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'User');
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'CUSTOMER');
  user_city := NEW.raw_user_meta_data->>'city';
  user_category := NEW.raw_user_meta_data->>'category';

  -- Map role to account_type
  IF user_role = 'PRO' THEN
    account_type_value := 'professional';
  ELSE
    account_type_value := 'customer';
  END IF;

  -- Insert profile with city and category
  INSERT INTO public.profiles (id, name, email, role, account_type, city, category, created_at)
  VALUES (
    NEW.id,
    user_name,
    NEW.email,
    user_role,
    account_type_value,
    user_city,
    user_category,
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
