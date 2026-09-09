-- H3 Security Fix: revoke earn_reward from authenticated clients.
--
-- earn_reward(uuid, text) was previously callable by any authenticated user,
-- allowing arbitrary p_user_id and p_reward_type values. While the unique index
-- on reward_history limited most damage, the 'referral' type had no per-call cap.
--
-- Fix: REVOKE EXECUTE from PUBLIC and authenticated.
--   • All DB-internal callers (triggers, SECURITY DEFINER functions) run as the
--     function owner (postgres) and are unaffected by this REVOKE.
--   • Client-side reward claims are now routed through /api/rewards/claim which
--     validates the caller's identity server-side and restricts allowed types.
--
-- Affected DB callers (unaffected by REVOKE — all SECURITY DEFINER):
--   • handle_new_user_credits trigger  → 'registration'
--   • grant_referral_reward_if_eligible → 'referral'

REVOKE EXECUTE ON FUNCTION public.earn_reward(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.earn_reward(uuid, text) FROM authenticated;
