/*
  # Add Default Value for post_type Column

  1. Changes
    - Add a function to automatically set post_type based on user's account_type
    - Create trigger to auto-set post_type on INSERT if not provided

  2. Behavior
    - For professional users: defaults to 'portfolio_post'
    - For customer users: defaults to 'service_request'
*/

-- Create function to set default post_type based on user's account_type
CREATE OR REPLACE FUNCTION set_default_post_type()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set post_type if not already provided
  IF NEW.post_type IS NULL THEN
    -- Get user's account type and set appropriate post_type
    SELECT 
      CASE 
        WHEN account_type = 'professional' THEN 'portfolio_post'::text
        ELSE 'service_request'::text
      END
    INTO NEW.post_type
    FROM profiles
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-set post_type
DROP TRIGGER IF EXISTS set_post_type_trigger ON posts;
CREATE TRIGGER set_post_type_trigger
  BEFORE INSERT ON posts
  FOR EACH ROW
  EXECUTE FUNCTION set_default_post_type();
