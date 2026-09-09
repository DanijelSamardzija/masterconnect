-- N1 (revised): Protect is_admin and is_premium from client-side escalation.
--
-- CONTEXT: 20260913000001 attempted REVOKE UPDATE (is_admin, is_premium) FROM
-- authenticated, but that is a no-op when authenticated holds a table-level
-- UPDATE grant (which Supabase grants by default). has_column_privilege()
-- confirmed the revoke had no effect.
--
-- CORRECT FIX: BEFORE UPDATE trigger that inspects current_user at runtime.
-- In Supabase:
--   authenticated client request  → current_user = 'authenticated'
--   SECURITY DEFINER function     → current_user = function owner (postgres)
--   service_role API call         → current_user = 'service_role'
--
-- When become_creator_premium (SECURITY DEFINER, owner = postgres) executes
-- UPDATE profiles SET is_premium = true, the trigger fires with
-- current_user = 'postgres', so the guard does NOT block it.
-- When an authenticated client sends PATCH /rest/v1/profiles?id=eq.{uid}
-- with { is_admin: true }, current_user = 'authenticated' → blocked.
--
-- ENABLE ALWAYS: the trigger fires regardless of session_replication_role so
-- it remains active during replication and in migration test suites that use
-- session_replication_role = replica for FK bypass. The current_user guard
-- ensures postgres/service_role calls are not affected.

CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER   -- intentionally INVOKER so current_user is the actual caller
SET search_path = public
AS $$
BEGIN
  -- Block changes to privilege columns from authenticated clients.
  -- All trusted callers (SECURITY DEFINER functions, service_role, postgres)
  -- run as a role other than 'authenticated'.
  IF current_user = 'authenticated' THEN
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
      RAISE EXCEPTION 'permission_denied'
        USING DETAIL  = 'is_admin cannot be modified by authenticated clients',
              ERRCODE = '42501';
    END IF;
    IF NEW.is_premium IS DISTINCT FROM OLD.is_premium THEN
      RAISE EXCEPTION 'permission_denied'
        USING DETAIL  = 'is_premium cannot be modified by authenticated clients',
              ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ENABLE ALWAYS so the trigger fires even when session_replication_role = replica
-- (e.g. during replication or test suites that use replica mode for FK bypass).
-- The current_user guard inside still allows postgres and service_role callers.
CREATE OR REPLACE TRIGGER profiles_prevent_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_privilege_escalation();

ALTER TABLE public.profiles
  ENABLE ALWAYS TRIGGER profiles_prevent_privilege_escalation;
