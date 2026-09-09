-- Referral anti-abuse: defer reward to first post of referred user.
--
-- BEFORE: apply_referral() inserts referrals(reward_given=true) and immediately
--         calls earn_reward(), awarding 50cr at account-creation time with zero
--         engagement requirement.
--
-- AFTER:  apply_referral() inserts referrals(reward_given=false). No credits yet.
--         When the referred user creates their first post a trigger calls
--         grant_referral_reward_if_eligible(), which:
--           - Locks the pending referral row (FOR UPDATE, READ COMMITTED re-eval
--             eliminates TOCTOU: second caller finds reward_given=true → exits)
--           - Checks daily cap: referrer may earn at most 5 referral rewards
--             per 24 hours (rewarded_at window)
--           - Flips reward_given=true and rewarded_at=now() BEFORE crediting,
--             so any exception in earn_reward() rolls back the flag atomically
--           - Calls earn_reward(referrer_id, 'referral') → +50cr
--
-- Duplicate-safety matrix:
--   Race A  — two post inserts fire trigger simultaneously for same user:
--             first caller locks row, commits; second caller's WHERE
--             reward_given=false finds no row (READ COMMITTED) → returns.
--   Race B  — apply_referral called twice for same referred_id:
--             unique constraint on referred_id raises unique_violation → 'already_applied'.
--   Race C  — referral created while trigger fires on unrelated post:
--             trigger checked before INSERT → no pending row → noop.
--
-- Backfill: existing rows with reward_given=true are NEVER touched by the new
--           function (WHERE reward_given=false); rewarded_at=created_at is set
--           only where rewarded_at IS NULL to give admin dashboards a timestamp.

-- ─── Step 1: Add rewarded_at ─────────────────────────────────────────────────

ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS rewarded_at timestamptz;

-- Backfill existing paid-out rows (best-effort timestamp; never re-rewarded)
UPDATE public.referrals
SET    rewarded_at = created_at
WHERE  reward_given = true
  AND  rewarded_at IS NULL;

-- Index for daily-cap query (referrer_id + rewarded_at range)
CREATE INDEX IF NOT EXISTS referrals_referrer_rewarded_at_idx
  ON public.referrals (referrer_id, rewarded_at)
  WHERE reward_given = true;

-- ─── Step 2: Eligibility + reward function ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.grant_referral_reward_if_eligible(p_referred_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral_id uuid;
  v_referrer_id uuid;
  v_daily_count integer;
BEGIN
  -- Lock the single pending referral row for this referred user.
  -- READ COMMITTED semantics (default): after a concurrent transaction commits
  -- with reward_given=true, this SELECT re-evaluates WHERE reward_given=false
  -- against committed data and returns no rows → safe exit.
  SELECT id, referrer_id
  INTO   v_referral_id, v_referrer_id
  FROM   public.referrals
  WHERE  referred_id  = p_referred_id
    AND  reward_given = false
  FOR UPDATE;

  IF v_referral_id IS NULL THEN
    RETURN;
  END IF;

  -- Daily cap: referrer earns at most 5 referral rewards per 24 hours.
  -- Uses rewarded_at (actual reward time) rather than created_at.
  SELECT COUNT(*)
  INTO   v_daily_count
  FROM   public.referrals
  WHERE  referrer_id  = v_referrer_id
    AND  reward_given = true
    AND  rewarded_at >= now() - INTERVAL '1 day';

  IF v_daily_count >= 5 THEN
    RETURN;
  END IF;

  -- Flip the flag FIRST. If earn_reward() raises, the entire transaction
  -- rolls back and reward_given stays false — no phantom credits, no lost rows.
  UPDATE public.referrals
  SET    reward_given = true,
         rewarded_at  = now()
  WHERE  id = v_referral_id;

  -- Credit the referrer (+50cr via earn_reward which also writes credit_transactions)
  PERFORM public.earn_reward(v_referrer_id, 'referral');
END;
$$;

-- ─── Step 3: Trigger on posts INSERT ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_referral_on_post_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.grant_referral_reward_if_eligible(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_post_insert_referral ON public.posts;
CREATE TRIGGER after_post_insert_referral
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_referral_on_post_insert();

-- ─── Step 4: Rewrite apply_referral — defer reward ───────────────────────────
-- Identical interface and return shape; only change: reward_given=false (was true)
-- and earn_reward() call removed. Callers (auth/callback) need no changes.

CREATE OR REPLACE FUNCTION public.apply_referral(
  p_referred_id   uuid,
  p_referral_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id uuid;
BEGIN
  SELECT id INTO v_referrer_id
  FROM   public.profiles
  WHERE  referral_code = p_referral_code;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  IF v_referrer_id = p_referred_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self_referral');
  END IF;

  BEGIN
    -- reward_given=false: reward deferred until referred user's first post.
    -- Unique constraint on referred_id (from 20260721170000) is the atomic guard
    -- against duplicate rows — no SELECT EXISTS needed.
    INSERT INTO public.referrals (referrer_id, referred_id, reward_given)
    VALUES (v_referrer_id, p_referred_id, false);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_applied');
  END;

  UPDATE public.profiles
  SET    referred_by = v_referrer_id
  WHERE  id = p_referred_id;

  RETURN jsonb_build_object('ok', true, 'referrer_id', v_referrer_id);
END;
$$;
