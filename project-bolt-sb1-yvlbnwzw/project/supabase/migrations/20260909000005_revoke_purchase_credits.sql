-- Ensure purchase_credits is never callable by authenticated users.
-- Source migration (20260725000002) was already fixed to not grant access,
-- but this migration acts as a safety net if the function was deployed without the fix.
-- Idempotent: safe to run whether or not the function currently exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'purchase_credits'
  ) THEN
    REVOKE EXECUTE ON FUNCTION purchase_credits(uuid, integer, text) FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION purchase_credits(uuid, integer, text) FROM authenticated;
    GRANT  EXECUTE ON FUNCTION purchase_credits(uuid, integer, text) TO service_role;
  END IF;
END;
$$;
