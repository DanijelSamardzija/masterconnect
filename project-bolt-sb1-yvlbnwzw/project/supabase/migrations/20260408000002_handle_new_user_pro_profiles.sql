CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  user_name text;
  user_account_type text;
  user_city text;
  user_country text;
  user_category text;
BEGIN
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'User');
  user_account_type := COALESCE(NEW.raw_user_meta_data->>'account_type', 'customer');
  user_city := NEW.raw_user_meta_data->>'city';
  user_country := NEW.raw_user_meta_data->>'country';
  user_category := NEW.raw_user_meta_data->>'category';

  INSERT INTO public.profiles (id, name, email, account_type, role, city, country, category, created_at)
  VALUES (NEW.id, user_name, NEW.email, user_account_type, user_account_type, user_city, user_country, user_category, NOW())
  ON CONFLICT (id) DO NOTHING;

  IF user_account_type = 'professional' THEN
    INSERT INTO public.pro_profiles (user_id, created_at)
    VALUES (NEW.id, NOW())
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
