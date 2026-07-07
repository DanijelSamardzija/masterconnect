-- Fix registration: ensure account_type and role columns have defaults
-- so the handle_new_user trigger can safely insert new profiles.
ALTER TABLE public.profiles
  ALTER COLUMN account_type SET DEFAULT 'customer';

ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'customer';

-- Rewrite trigger: minimal insert, let column defaults handle the rest.
-- EXCEPTION block prevents trigger failures from blocking user creation.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_name     text;
  v_city     text;
  v_country  text;
  v_category text;
BEGIN
  v_name     := COALESCE(NEW.raw_user_meta_data->>'full_name', 'User');
  v_city     := NEW.raw_user_meta_data->>'city';
  v_country  := NEW.raw_user_meta_data->>'country';
  v_category := NEW.raw_user_meta_data->>'category';

  INSERT INTO public.profiles (id, name, email, city, country, category, created_at)
  VALUES (NEW.id, v_name, NEW.email, v_city, v_country, v_category, NOW())
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;
