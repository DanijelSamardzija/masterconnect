-- Referral anti-abuse — test suite
-- Run: supabase db query --linked -f supabase/tests/referral_anti_abuse_test.sql
--
-- Strategy:
--   SET LOCAL session_replication_role = replica
--     → bypasses FK checks (profiles→auth.users, referrals→profiles, etc.)
--     → is transaction-local: automatically reset on ROLLBACK (safe for pooled connections)
--     → also disables non-ALWAYS triggers by default
--   ALTER TABLE posts ENABLE ALWAYS TRIGGER after_post_insert_referral
--     → re-enables our trigger in replica mode; DDL is transactional → rolled back
--
--   ROLLBACK at end undoes ALL: test rows + trigger state + session_replication_role.
--   Production data is never modified.

BEGIN;

-- TX-local: replica mode for FK bypass; resets automatically on ROLLBACK
SET LOCAL session_replication_role = replica;

-- Re-enable our post-insert trigger even in replica mode (rolled back with tx)
ALTER TABLE posts ENABLE ALWAYS TRIGGER after_post_insert_referral;

DO $$
DECLARE
  -- Synthetic UUIDs — deliberately outside any realistic UUID space
  v_referrer_id   uuid := '00000000-0000-0000-0001-000000000001';
  v_referred_id   uuid := '00000000-0000-0000-0001-000000000002';
  v_referrer2_id  uuid := '00000000-0000-0000-0001-000000000003';
  v_referred2_id  uuid := '00000000-0000-0000-0001-000000000004';

  v_referral_code text := '_test_referral_code_abc123';
  v_result        jsonb;
  v_rw_given      boolean;
  v_rw_at         timestamptz;
  v_balance       numeric;
  i               integer;
  v_extra_usr_id  uuid;
  v_extra_ref_id  uuid;
BEGIN

  -----------------------------------------------------------------------
  -- Setup: minimal profile rows (FK to auth.users bypassed in replica mode)
  -- Providing all NOT NULL columns without DB defaults: name, role, email, account_type
  -----------------------------------------------------------------------
  INSERT INTO public.profiles (id, name, role, email, account_type, referral_code)
  VALUES
    (v_referrer_id,  'Test Referrer',  'personal', '_test_r1@test.invalid', 'personal', v_referral_code),
    (v_referred_id,  'Test Referred',  'personal', '_test_r2@test.invalid', 'personal', '_test_ref_2'),
    (v_referrer2_id, 'Test Referrer2', 'personal', '_test_r3@test.invalid', 'personal', '_test_ref_3'),
    (v_referred2_id, 'Test Referred2', 'personal', '_test_r4@test.invalid', 'personal', '_test_ref_4');

  -- Credits balances (trigger_new_user_credits is disabled in replica mode — we set manually)
  INSERT INTO public.credits_balance (user_id, balance)
  VALUES
    (v_referrer_id,  100),
    (v_referred_id,  5),
    (v_referrer2_id, 100),
    (v_referred2_id, 5);

  -----------------------------------------------------------------------
  -- T1 — self_referral: user applies their own code → blocked
  -----------------------------------------------------------------------
  v_result := public.apply_referral(v_referrer_id, v_referral_code);

  IF (v_result->>'error') = 'self_referral' THEN
    RAISE NOTICE 'PASS  T1  self_referral blocked correctly';
  ELSE
    RAISE EXCEPTION 'FAIL  T1  expected self_referral, got: %', v_result;
  END IF;

  -----------------------------------------------------------------------
  -- T2 — invalid code: unknown code → blocked
  -----------------------------------------------------------------------
  v_result := public.apply_referral(v_referred_id, 'NONEXISTENT_CODE_XYZ');

  IF (v_result->>'error') = 'invalid_code' THEN
    RAISE NOTICE 'PASS  T2  invalid_code blocked correctly';
  ELSE
    RAISE EXCEPTION 'FAIL  T2  expected invalid_code, got: %', v_result;
  END IF;

  -----------------------------------------------------------------------
  -- T3 — valid referral: row created with reward_given=false, no credits yet
  -----------------------------------------------------------------------
  v_result := public.apply_referral(v_referred_id, v_referral_code);

  IF NOT (v_result->>'ok')::boolean THEN
    RAISE EXCEPTION 'FAIL  T3a apply_referral returned error: %', v_result;
  END IF;

  SELECT reward_given INTO v_rw_given
  FROM public.referrals WHERE referred_id = v_referred_id;

  IF v_rw_given = false THEN
    RAISE NOTICE 'PASS  T3a referral row created with reward_given=false (deferred)';
  ELSE
    RAISE EXCEPTION 'FAIL  T3a expected reward_given=false, got: %', v_rw_given;
  END IF;

  SELECT balance INTO v_balance
  FROM public.credits_balance WHERE user_id = v_referrer_id;

  IF v_balance = 100 THEN
    RAISE NOTICE 'PASS  T3b referrer balance unchanged after apply_referral (was 100)';
  ELSE
    RAISE EXCEPTION 'FAIL  T3b expected 100cr, got: %cr', v_balance;
  END IF;

  -----------------------------------------------------------------------
  -- T4 — already_applied: second apply_referral for same referred user → blocked
  -----------------------------------------------------------------------
  v_result := public.apply_referral(v_referred_id, v_referral_code);

  IF (v_result->>'error') = 'already_applied' THEN
    RAISE NOTICE 'PASS  T4  duplicate apply_referral blocked (unique constraint)';
  ELSE
    RAISE EXCEPTION 'FAIL  T4  expected already_applied, got: %', v_result;
  END IF;

  -----------------------------------------------------------------------
  -- T5 — first post: trigger fires → reward_given=true, rewarded_at set, referrer +50cr
  -----------------------------------------------------------------------
  INSERT INTO public.posts (id, user_id, text, post_type)
  VALUES (gen_random_uuid(), v_referred_id, 'Test post content', 'social_post');

  SELECT reward_given, rewarded_at INTO v_rw_given, v_rw_at
  FROM public.referrals WHERE referred_id = v_referred_id;

  IF v_rw_given = true THEN
    RAISE NOTICE 'PASS  T5a reward_given=true after first post';
  ELSE
    RAISE EXCEPTION 'FAIL  T5a expected reward_given=true, got: %', v_rw_given;
  END IF;

  IF v_rw_at IS NOT NULL THEN
    RAISE NOTICE 'PASS  T5b rewarded_at is set (not NULL)';
  ELSE
    RAISE EXCEPTION 'FAIL  T5b expected rewarded_at to be set';
  END IF;

  SELECT balance INTO v_balance
  FROM public.credits_balance WHERE user_id = v_referrer_id;

  IF v_balance = 150 THEN
    RAISE NOTICE 'PASS  T5c referrer received +50cr: 100 → 150';
  ELSE
    RAISE EXCEPTION 'FAIL  T5c expected 150cr, got: %cr', v_balance;
  END IF;

  -----------------------------------------------------------------------
  -- T6 — second post: trigger fires again but no double reward
  -----------------------------------------------------------------------
  INSERT INTO public.posts (id, user_id, text, post_type)
  VALUES (gen_random_uuid(), v_referred_id, 'Second post', 'social_post');

  SELECT balance INTO v_balance
  FROM public.credits_balance WHERE user_id = v_referrer_id;

  IF v_balance = 150 THEN
    RAISE NOTICE 'PASS  T6  no double reward on second post (balance still 150cr)';
  ELSE
    RAISE EXCEPTION 'FAIL  T6  expected 150cr still, got: %cr', v_balance;
  END IF;

  -----------------------------------------------------------------------
  -- T7 — pre-existing rewarded referral: backfilled row never re-rewarded
  -- Simulates a row written by the old apply_referral (reward_given=true from day 1)
  -----------------------------------------------------------------------
  INSERT INTO public.referrals (referrer_id, referred_id, reward_given, rewarded_at)
  VALUES (v_referrer_id, v_referred2_id, true, now() - INTERVAL '2 hours');

  -- Manually set balance to a known value so we can detect any unwanted change
  UPDATE public.credits_balance SET balance = 200 WHERE user_id = v_referrer_id;

  -- Calling the eligibility function directly on an already-rewarded user → noop
  PERFORM public.grant_referral_reward_if_eligible(v_referred2_id);

  SELECT balance INTO v_balance
  FROM public.credits_balance WHERE user_id = v_referrer_id;

  IF v_balance = 200 THEN
    RAISE NOTICE 'PASS  T7  pre-migration reward_given=true row not double-rewarded';
  ELSE
    RAISE EXCEPTION 'FAIL  T7  expected 200cr unchanged, got: %cr', v_balance;
  END IF;

  -----------------------------------------------------------------------
  -- T8 — daily cap: 6th referral in 24h blocked; row stays reward_given=false
  -- (reward deferred, not lost — will retry next day)
  -----------------------------------------------------------------------
  -- Create 5 referrals for referrer2 already rewarded today
  FOR i IN 1..5 LOOP
    v_extra_usr_id := gen_random_uuid();
    INSERT INTO public.profiles (id, name, role, email, account_type)
    VALUES (v_extra_usr_id, 'Cap User ' || i, 'personal', '_cap' || i || '@test.invalid', 'personal');
    INSERT INTO public.credits_balance (user_id, balance) VALUES (v_extra_usr_id, 0);
    INSERT INTO public.referrals (referrer_id, referred_id, reward_given, rewarded_at)
    VALUES (v_referrer2_id, v_extra_usr_id, true, now() - INTERVAL '30 minutes');
  END LOOP;

  -- Set a known balance for referrer2
  UPDATE public.credits_balance SET balance = 500 WHERE user_id = v_referrer2_id;

  -- 6th referred user: pending referral
  v_extra_ref_id := gen_random_uuid();
  INSERT INTO public.profiles (id, name, role, email, account_type)
  VALUES (v_extra_ref_id, 'Cap Test 6', 'personal', '_cap6@test.invalid', 'personal');
  INSERT INTO public.credits_balance (user_id, balance) VALUES (v_extra_ref_id, 0);
  INSERT INTO public.referrals (referrer_id, referred_id, reward_given)
  VALUES (v_referrer2_id, v_extra_ref_id, false);

  -- First post by 6th referred user → trigger fires, but daily cap blocks reward
  INSERT INTO public.posts (id, user_id, text, post_type)
  VALUES (gen_random_uuid(), v_extra_ref_id, 'Cap test post', 'social_post');

  SELECT balance INTO v_balance
  FROM public.credits_balance WHERE user_id = v_referrer2_id;

  IF v_balance = 500 THEN
    RAISE NOTICE 'PASS  T8a daily cap (5/24h) blocks 6th reward (balance still 500cr)';
  ELSE
    RAISE EXCEPTION 'FAIL  T8a expected 500cr (cap enforced), got: %cr', v_balance;
  END IF;

  -- Row must stay reward_given=false (reward deferred, not lost forever)
  SELECT reward_given INTO v_rw_given
  FROM public.referrals WHERE referred_id = v_extra_ref_id;

  IF v_rw_given = false THEN
    RAISE NOTICE 'PASS  T8b capped row keeps reward_given=false (deferred, not lost)';
  ELSE
    RAISE EXCEPTION 'FAIL  T8b expected reward_given=false, got: %', v_rw_given;
  END IF;

  -----------------------------------------------------------------------
  -- T9 — concurrent-safe: calling grant_referral_reward_if_eligible twice
  -- serially for the same user (simulates two triggers after lock release).
  -- After T5 committed reward_given=true, second call must be noop.
  -----------------------------------------------------------------------
  UPDATE public.credits_balance SET balance = 300 WHERE user_id = v_referrer_id;

  PERFORM public.grant_referral_reward_if_eligible(v_referred_id);

  SELECT balance INTO v_balance
  FROM public.credits_balance WHERE user_id = v_referrer_id;

  IF v_balance = 300 THEN
    RAISE NOTICE 'PASS  T9  concurrent-safe: repeated call noop (reward_given=true re-eval)';
  ELSE
    RAISE EXCEPTION 'FAIL  T9  expected 300cr, got: %cr', v_balance;
  END IF;

  -----------------------------------------------------------------------
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════════════════';
  RAISE NOTICE 'All 9 referral anti-abuse tests PASSED.';
  RAISE NOTICE '══════════════════════════════════════════════════════';
  RAISE NOTICE 'Transaction will now ROLLBACK — no production data changed.';

END;
$$;

-- All test data (profiles, referrals, credits, posts) rolled back.
-- session_replication_role and trigger ENABLE ALWAYS also rolled back (SET LOCAL + transactional DDL).
ROLLBACK;
