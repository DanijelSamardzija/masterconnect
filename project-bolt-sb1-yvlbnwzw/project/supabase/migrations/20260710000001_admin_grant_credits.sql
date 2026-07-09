-- Admin grant credits function
CREATE OR REPLACE FUNCTION admin_grant_credits(
  p_user_id  uuid,
  p_amount   integer,
  p_note     text DEFAULT 'Admin grant'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can call this
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  -- Upsert credits_balance
  INSERT INTO credits_balance (user_id, balance, updated_at)
  VALUES (p_user_id, p_amount, now())
  ON CONFLICT (user_id)
  DO UPDATE SET balance = credits_balance.balance + p_amount, updated_at = now();

  -- Record transaction
  INSERT INTO credit_transactions (user_id, amount, type, description)
  VALUES (p_user_id, p_amount, 'admin_grant', p_note);

  -- Notify user
  INSERT INTO notifications (user_id, type, action_type, title, body)
  VALUES (
    p_user_id,
    'credit',
    'admin_grant',
    'Dobili ste kredite!',
    'Administrator vam je dodijelio ' || p_amount || ' kredita. ' || p_note
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_grant_credits(uuid, integer, text) TO authenticated;
