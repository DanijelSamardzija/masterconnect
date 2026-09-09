-- N2: Restrict earn_post_reward to server-side (service_role) callers only.
--
-- PROBLEM: earn_post_reward has no REVOKE statement — PUBLIC (which includes
-- every authenticated user) can call it directly from the browser with any
-- p_user_id, enabling:
--   1. Earning 5–20 credits/day without posting actual media.
--   2. Injecting credits into another user's account.
--
-- FIX: Revoke execute from PUBLIC and authenticated, grant only to service_role.
-- The client-side supabase.rpc('earn_post_reward', …) in create-post-modal.tsx
-- is replaced with a POST to /api/rewards/post-reward which validates the
-- caller's JWT and only passes the authenticated user's own id to the function.
--
-- SAME PATTERN AS H3 (earn_reward was locked down in 20260912000002).
-- No business-logic changes: amounts, daily limits, advisory lock all unchanged.

REVOKE EXECUTE ON FUNCTION public.earn_post_reward(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.earn_post_reward(uuid, text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.earn_post_reward(uuid, text) TO service_role;
