INSERT INTO pro_profiles (user_id, created_at)
SELECT id, NOW() FROM profiles
WHERE account_type = 'professional'
ON CONFLICT (user_id) DO NOTHING