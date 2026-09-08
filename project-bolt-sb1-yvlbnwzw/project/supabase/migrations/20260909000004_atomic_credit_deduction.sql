-- Atomic credit deduction: replaces all SELECT+UPDATE patterns in AI routes
-- Raises 'insufficient_credits' if balance < amount (safe from race conditions)

CREATE OR REPLACE FUNCTION deduct_credits_atomic(
  p_user_id      uuid,
  p_amount       integer,
  p_type         text,
  p_description  text,
  p_reference_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance integer;
BEGIN
  UPDATE credits_balance
  SET
    balance    = balance - p_amount,
    updated_at = now()
  WHERE
    user_id = p_user_id
    AND balance >= p_amount
  RETURNING balance INTO v_new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_credits'
      USING DETAIL = p_user_id::text, HINT = p_amount::text;
  END IF;

  INSERT INTO credit_transactions (
    user_id, amount, type, description, reference_id
  ) VALUES (
    p_user_id, -p_amount, p_type, p_description, p_reference_id
  );

  RETURN v_new_balance;
END;
$$;

REVOKE ALL ON FUNCTION deduct_credits_atomic(uuid, integer, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION deduct_credits_atomic(uuid, integer, text, text, uuid) TO service_role;
