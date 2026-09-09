-- N1: Prevent authenticated users from self-escalating privilege columns on profiles.
--
-- PROBLEM: The "Users can update their own profile" RLS policy has no column
-- restriction, so any authenticated user can PATCH /rest/v1/profiles with
-- { is_admin: true } or { is_premium: true } and the policy allows it.
--
-- FIX: Column-level REVOKE removes UPDATE privilege on these two columns from
-- the authenticated role. A column-level REVOKE takes effect *after* RLS —
-- even when the row-level policy says USING (auth.uid() = id), the DB engine
-- will reject any UPDATE that touches a column the caller may not write.
--
-- WHAT IS NOT AFFECTED:
--   • become_creator_premium()  — SECURITY DEFINER (runs as postgres/owner),
--     not bound by the authenticated role's column privileges.
--   • Admin routes / service_role — not the authenticated role.
--   • All normal profile fields (name, bio, avatar_url, city, …) — untouched.
--
-- COLUMNS PROTECTED:
--   is_admin    — only ever set by direct SQL from a superuser / admin tooling.
--   is_premium  — only ever set by become_creator_premium() (500 cr cost).

REVOKE UPDATE (is_admin)   ON public.profiles FROM authenticated;
REVOKE UPDATE (is_premium) ON public.profiles FROM authenticated;
