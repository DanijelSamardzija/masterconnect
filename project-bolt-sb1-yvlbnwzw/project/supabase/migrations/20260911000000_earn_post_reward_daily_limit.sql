-- Refactor earn_post_reward daily limit to use a typed column instead of
-- the description string.
--
-- WHY: the daily-cap check currently counts credit_transactions rows by
-- matching description = 'Post nagrada: slika' / 'Post nagrada: video'.
-- Any rename of that string (translation, rebrand) would silently reset the
-- cap and let users collect the same reward again. A dedicated nullable column
-- with a CHECK constraint is stable regardless of display text changes.
--
-- WHAT CHANGES:
--   1. ADD media_reward_type text CHECK ('image','video') NULLABLE to
--      credit_transactions (NULL for all non-post-reward rows).
--   2. Backfill existing post-reward rows from their description strings.
--   3. Add a partial composite index covering the daily-count query.
--   4. Replace earn_post_reward() so the COUNT and INSERT use media_reward_type.
--
-- WHAT DOES NOT CHANGE:
--   - description string ('Post nagrada: slika' / 'Post nagrada: video')
--     is still written and still used by admin UI display.
--   - Advisory lock (pg_advisory_xact_lock) stays — prevents concurrent races.
--   - Reward amounts and daily limits: image 5 cr max 2/day, video 20 cr max 1/day.
--   - earn_reward(), send_credits(), and all other credit functions untouched.
--   - Frontend code and TypeScript types require no changes (nullable column).
--
-- TIMEZONE NOTE:
--   The DB runs in UTC. CURRENT_DATE was already UTC-day-based.
--   The new code uses (now() AT TIME ZONE 'UTC')::date explicitly so the
--   intent is visible — behaviour is identical to the previous CURRENT_DATE.

-- ─── Step 1: Add media_reward_type column ─────────────────────────────────────
ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS media_reward_type text
  CHECK (media_reward_type IN ('image', 'video'));

-- ─── Step 2: Backfill existing post-reward transactions ───────────────────────
UPDATE public.credit_transactions
SET media_reward_type = 'image'
WHERE description = 'Post nagrada: slika'
  AND type = 'earn'
  AND media_reward_type IS NULL;

UPDATE public.credit_transactions
SET media_reward_type = 'video'
WHERE description = 'Post nagrada: video'
  AND type = 'earn'
  AND media_reward_type IS NULL;

-- ─── Step 3: Partial composite index for daily-count query ────────────────────
-- Covers: user_id + media_reward_type + created_at WHERE media_reward_type IS NOT NULL
-- Partial: skips the ~99% of rows where media_reward_type IS NULL.
CREATE INDEX IF NOT EXISTS credit_transactions_post_reward_daily_idx
  ON public.credit_transactions (user_id, media_reward_type, created_at)
  WHERE media_reward_type IS NOT NULL;

-- ─── Step 4: Update earn_post_reward to use media_reward_type ─────────────────
CREATE OR REPLACE FUNCTION public.earn_post_reward(
  p_user_id    uuid,
  p_media_type text  -- 'image' or 'video'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount         integer;
  v_max_daily      integer;
  v_desc           text;
  v_count          integer;
  v_today_start    timestamptz;
  v_today_end      timestamptz;
BEGIN
  IF p_media_type = 'image' THEN
    v_amount    := 5;
    v_max_daily := 2;
    v_desc      := 'Post nagrada: slika';
  ELSIF p_media_type = 'video' THEN
    v_amount    := 20;
    v_max_daily := 1;
    v_desc      := 'Post nagrada: video';
  ELSE
    RETURN 0;
  END IF;

  -- UTC day window (explicit; equivalent to CURRENT_DATE on a UTC-timezone DB,
  -- but stated clearly so the intent survives future server timezone changes).
  v_today_start := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_today_end   := v_today_start + interval '1 day';

  -- Serialize concurrent calls for the same user + media type.
  -- Prevents two simultaneous uploads from both passing the COUNT check.
  PERFORM pg_advisory_xact_lock(
    ('x' || md5(p_user_id::text || p_media_type))::bit(64)::bigint
  );

  PERFORM ensure_credits_balance(p_user_id);

  -- Daily cap: count using the typed column, not the description string.
  -- Uses the partial index: credit_transactions_post_reward_daily_idx.
  SELECT COUNT(*) INTO v_count
  FROM public.credit_transactions
  WHERE user_id          = p_user_id
    AND media_reward_type = p_media_type
    AND created_at       >= v_today_start
    AND created_at        < v_today_end;

  IF v_count >= v_max_daily THEN
    RETURN 0;
  END IF;

  UPDATE public.credits_balance
  SET balance = balance + v_amount, updated_at = now()
  WHERE user_id = p_user_id;

  -- Both media_reward_type and description are written.
  -- media_reward_type: machine-readable cap identifier (stable).
  -- description:       human-readable display string for admin UI (unchanged).
  INSERT INTO public.credit_transactions
    (user_id, amount, type, description, media_reward_type, status)
  VALUES
    (p_user_id, v_amount, 'earn', v_desc, p_media_type, 'completed');

  RETURN v_amount;
END;
$$;
