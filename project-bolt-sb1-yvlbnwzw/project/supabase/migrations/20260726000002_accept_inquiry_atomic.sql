-- Atomic accept_inquiry RPC.
--
-- Replaces the previous two-phase JS approach (update status → pay separately)
-- with a single PostgreSQL transaction. Either everything succeeds and commits,
-- or nothing changes — no "accepted without payment" state is possible.
--
-- Guarantees:
--   1. FOR UPDATE locks the inquiry row; concurrent accepts block, then get 'not_pending'.
--   2. Credit deduction is atomic (WHERE balance >= v_price).
--   3. If deduction fails, RAISE EXCEPTION rolls back the lock and all prior changes.
--   4. Status update happens in the same transaction as payment — never split across HTTP calls.

CREATE OR REPLACE FUNCTION accept_inquiry(p_inquiry_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inquiry  record;
  v_price    integer;
BEGIN
  -- Lock the row for the duration of this transaction.
  -- A second concurrent accept blocks here, then finds status != 'pending'.
  SELECT id, status, sender_id, receiver_id, subject_meta
  INTO   v_inquiry
  FROM   inquiries
  WHERE  id = p_inquiry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Only the receiver (creator) may accept.
  IF v_inquiry.receiver_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- Expired, declined, or already accepted inquiries are rejected here.
  IF v_inquiry.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending');
  END IF;

  -- Price from immutable subject_meta snapshot (0 = free inquiry).
  v_price := COALESCE((v_inquiry.subject_meta->>'price')::numeric::integer, 0);

  IF v_price > 0 THEN
    -- Ensure receiver has a balance row before crediting.
    PERFORM ensure_credits_balance(v_inquiry.receiver_id);

    -- Atomic deduction: no-op + RAISE if payer balance is insufficient.
    UPDATE credits_balance
    SET    balance    = balance - v_price,
           updated_at = now()
    WHERE  user_id = v_inquiry.sender_id
      AND  balance >= v_price;

    IF NOT FOUND THEN
      -- RAISE aborts the transaction — FOR UPDATE lock released, no partial state.
      RAISE EXCEPTION 'insufficient_balance';
    END IF;

    -- Credit the receiver.
    UPDATE credits_balance
    SET    balance    = balance + v_price,
           updated_at = now()
    WHERE  user_id = v_inquiry.receiver_id;

    -- Dual ledger entries; reference_id links both rows to this inquiry.
    INSERT INTO credit_transactions
      (user_id, sender_id, receiver_id, amount, platform_fee, type, description, status, reference_id, anonymous)
    VALUES
      (v_inquiry.sender_id,
       v_inquiry.sender_id, v_inquiry.receiver_id,
       -v_price, 0, 'spend',
       'Inquiry: ' || COALESCE(v_inquiry.subject_meta->>'title', 'Service'),
       'completed', p_inquiry_id, false),
      (v_inquiry.receiver_id,
       v_inquiry.sender_id, v_inquiry.receiver_id,
       v_price, 0, 'earn',
       'Inquiry: ' || COALESCE(v_inquiry.subject_meta->>'title', 'Service'),
       'completed', p_inquiry_id, false);
  END IF;

  -- Status update is in the same transaction as the payment above.
  UPDATE inquiries
  SET    status       = 'accepted',
         responded_at = now()
  WHERE  id = p_inquiry_id;

  RETURN jsonb_build_object('ok', true, 'amount', v_price);

EXCEPTION
  WHEN OTHERS THEN
    -- Translate known RAISE messages into structured responses.
    -- PostgreSQL has already rolled back all changes in this block.
    IF SQLERRM = 'insufficient_balance' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'insufficient_balance');
    END IF;
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION accept_inquiry(uuid) TO authenticated;
