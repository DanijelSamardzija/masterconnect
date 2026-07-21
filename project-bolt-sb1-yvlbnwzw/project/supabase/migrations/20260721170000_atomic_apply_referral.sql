-- Fix race condition in apply_referral.
-- The old code used SELECT EXISTS + INSERT (TOCTOU): two simultaneous calls
-- for the same p_referred_id could both pass the existence check and both
-- insert into referrals, awarding the referrer double credits.
--
-- Fix: enforce uniqueness on referrals(referred_id) at the database level,
-- then let the INSERT itself detect duplicates via unique_violation instead
-- of doing a separate SELECT first. This eliminates the race window entirely.

-- Ensure referrals table exists. If it was already created via Supabase Studio
-- this is a no-op; if it somehow doesn't exist this creates it correctly.
CREATE TABLE IF NOT EXISTS public.referrals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reward_given boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Add UNIQUE constraint on referred_id if it doesn't already exist.
-- A person can only be referred once; this is the atomic guard.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'referrals_referred_id_unique'
      AND conrelid = 'public.referrals'::regclass
  ) THEN
    ALTER TABLE public.referrals
      ADD CONSTRAINT referrals_referred_id_unique UNIQUE (referred_id);
  END IF;
END;
$$;

-- Rewrite apply_referral: atomic INSERT replaces the racy SELECT EXISTS check.
-- Two simultaneous calls for the same p_referred_id: the first INSERT succeeds,
-- the second hits unique_violation and returns 'already_applied' cleanly.
-- earn_reward('referral') is therefore called exactly once per referral.
CREATE OR REPLACE FUNCTION public.apply_referral(
  p_referred_id  uuid,
  p_referral_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referrer_id uuid;
BEGIN
  SELECT id INTO v_referrer_id
  FROM profiles
  WHERE referral_code = p_referral_code;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  IF v_referrer_id = p_referred_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self_referral');
  END IF;

  -- Atomic guard: unique constraint on referred_id makes this the single
  -- point of truth. No SELECT needed — the INSERT either wins or raises.
  BEGIN
    INSERT INTO public.referrals (referrer_id, referred_id, reward_given)
    VALUES (v_referrer_id, p_referred_id, true);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_applied');
  END;

  UPDATE profiles SET referred_by = v_referrer_id WHERE id = p_referred_id;

  PERFORM public.earn_reward(v_referrer_id, 'referral');

  RETURN jsonb_build_object('ok', true, 'referrer_id', v_referrer_id);
END;
$$;
