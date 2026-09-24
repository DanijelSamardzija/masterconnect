-- Drop the old 3-param overload of add_staff_direct.
-- The 4-param version (p_business_id UUID DEFAULT NULL) handles both cases,
-- so PostgREST no longer gets PGRST203 ambiguous-overload errors.
DROP FUNCTION IF EXISTS public.add_staff_direct(UUID, TEXT, UUID);

NOTIFY pgrst, 'reload schema';
