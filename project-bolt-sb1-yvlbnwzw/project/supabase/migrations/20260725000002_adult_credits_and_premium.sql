-- Adult module: credits purchase function + premium subscription extensions

-- 1. Generic thread-type filtering support
--    threads.thread_type already exists. We add 'adult_inquiry' as a valid value
--    by extending the column — no constraint change needed (it's text, not enum).
--    The Messages inbox query will filter via an excludable types array
--    (implemented in client code, not hardcoded here).

-- 2. Adult subscriber flag on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS adult_subscriber boolean NOT NULL DEFAULT false;

-- 3. plan_type on premium_subscriptions (generic — not just for adult)
ALTER TABLE premium_subscriptions
  ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'gigzone'
  CHECK (plan_type IN ('gigzone', 'adult_creator', 'adult_subscriber'));

-- 4. purchase_credits — demo purchase, no real payment processor yet.
--    Adds credits + bonus to balance and logs a 'purchase' transaction.
--    Payment processor integration (CCBill/NovaPay) replaces this in Sprint 3.
CREATE OR REPLACE FUNCTION purchase_credits(
  p_user_id uuid,
  p_amount  integer,
  p_package text DEFAULT 'starter'
)
RETURNS jsonb AS $$
DECLARE
  v_bonus integer;
  v_total integer;
BEGIN
  IF p_amount < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  -- Bonus credits per package (demo incentive)
  v_bonus := CASE p_package
    WHEN 'popular' THEN 10
    WHEN 'pro'     THEN 50
    WHEN 'elite'   THEN 200
    ELSE 0
  END;

  v_total := p_amount + v_bonus;

  PERFORM ensure_credits_balance(p_user_id);

  UPDATE credits_balance
  SET balance = balance + v_total, updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO credit_transactions (user_id, amount, type, description, status)
  VALUES (
    p_user_id,
    v_total,
    'purchase',
    'Demo kupovina: ' || p_package || ' paket (' || v_total || ' kredita)',
    'completed'
  );

  RETURN jsonb_build_object(
    'ok',     true,
    'amount', p_amount,
    'bonus',  v_bonus,
    'total',  v_total
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- purchase_credits is service_role only; Stripe webhook handler calls it server-side.
-- Authenticated users must never call this directly (no payment verification).
REVOKE EXECUTE ON FUNCTION purchase_credits(uuid, integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION purchase_credits(uuid, integer, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION purchase_credits(uuid, integer, text) TO service_role;
