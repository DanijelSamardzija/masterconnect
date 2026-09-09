-- Referral anti-abuse — test suite
-- Run: supabase db query --linked -f supabase/tests/referral_anti_abuse_test.sql
--
-- Everything executes inside a transaction that is always rolled back,
-- so no test data leaks into the live database.
--
-- Output: RAISE NOTICE lines show PASS / FAIL for each assertion.
-- A failing assertion also raises an EXCEPTION so the script exits non-zero.

BEGIN;

DO $$
DECLARE
  -- Synthetic UUIDs that won't collide with real rows
  v_referrer_id   uuid := '00000000-0000-0000-0001-000000000001';
  v_referred_id   uuid := '00000000-0000-0000-0001-000000000002';
  v_referrer2_id  uuid := '00000000-0000-0000-0001-000000000003';
  v_referred2_id  uuid := '00000000-0000-0000-0001-000000000004';
  v_post_id       uuid;

  v_referral_code text := '_test_referral_code_abc123';
  v_result        jsonb;
  v_rw_given      boolean;
  v_balance       numeric;
  v_ref_count     integer;
  i               integer;
  v_extra_ref_id  uuid;
  v_extra_usr_id  uuid;
BEGIN

  -- ── Helpers: minimal profile rows (no FK to auth.users enforced in test) ───
  INSERT INTO public.profiles (id, username, referral_code, full_name)
  VALUES
    (v_referrer_id, '_test_referrer',  v_referral_code, 'Test Referrer'),
    (v_referred_id, '_test_referred',  '_test_ref_2',   'Test Referred'),
    (v_referrer2_id, '_test_referrer2', '_test_ref_3',  'Test Referrer2'),
    (v_referred2_id, '_test_referred2', '_test_ref_4',  'Test Referred2');

  INSERT INTO public.credits_balance (user_id, balance)
  VALUES
    (v_referrer_id,  100),
    (v_referred_id,  5),
    (v_referrer2_id, 100),
    (v_referred2_id, 5);

  -- ════════════════════════════════════════════════════════════════════════════
  -- TEST 1 — self_referral: user applies their own code → blocked
  -- ════════════════════════════════════════════════════════════════════════════
  v_result := public.apply_referral(v_referrer_id, v_referral_code);

  IF (v_result->>'error') = 'self_referral' THEN
    RAISE NOTICE 'PASS  T1  self_referral blocked';
  ELSE
    RAISE EXCEPTION 'FAIL  T1  expected self_referral, got: %', v_result;
  END IF;

  -- ════════════════════════════════════════════════════════════════════════════
  -- TEST 2 — invalid code → blocked
  -- ════════════════════════════════════════════════════════════════════════════
  v_result := public.apply_referral(v_referred_id, 'NONEXISTENT_CODE');

  IF (v_result->>'error') = 'invalid_code' THEN
    RAISE NOTICE 'PASS  T2  invalid_code blocked';
  ELSE
    RAISE EXCEPTION 'FAIL  T2  expected invalid_code, got: %', v_result;
  END IF;

  -- ════════════════════════════════════════════════════════════════════════════
  -- TEST 3 — valid referral: row created with reward_given=false, no credits yet
  -- ════════════════════════════════════════════════════════════════════════════
  v_result := public.apply_referral(v_referred_id, v_referral_code);

  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL  T3a apply_referral returned error: %', v_result;
  END IF;

  SELECT reward_given INTO v_rw_given
  FROM public.referrals
  WHERE referred_id = v_referred_id;

  IF v_rw_given = false THEN
    RAISE NOTICE 'PASS  T3a referral row created with reward_given=false';
  ELSE
    RAISE EXCEPTION 'FAIL  T3a expected reward_given=false, got: %', v_rw_given;
  END IF;

  SELECT balance INTO v_balance
  FROM public.credits_balance
  WHERE user_id = v_referrer_id;

  IF v_balance = 100 THEN
    RAISE NOTICE 'PASS  T3b referrer balance unchanged after apply_referral';
  ELSE
    RAISE EXCEPTION 'FAIL  T3b expected 100cr, got: %', v_balance;
  END IF;

  -- ════════════════════════════════════════════════════════════════════════════
  -- TEST 4 — already_applied: duplicate apply_referral for same referred user
  -- ════════════════════════════════════════════════════════════════════════════
  v_result := public.apply_referral(v_referred_id, v_referral_code);

  IF (v_result->>'error') = 'already_applied' THEN
    RAISE NOTICE 'PASS  T4  already_applied blocked (unique constraint)';
  ELSE
    RAISE EXCEPTION 'FAIL  T4  expected already_applied, got: %', v_result;
  END IF;

  -- ════════════════════════════════════════════════════════════════════════════
  -- TEST 5 — first post: trigger fires → reward_given=true, referrer +50cr
  -- ════════════════════════════════════════════════════════════════════════════
  v_post_id := gen_random_uuid();
  INSERT INTO public.posts (id, user_id, text, post_type, status)
  VALUES (v_post_id, v_referred_id, 'Test post', 'social_post', 'active');

  SELECT reward_given INTO v_rw_given
  FROM public.referrals
  WHERE referred_id = v_referred_id;

  IF v_rw_given = true THEN
    RAISE NOTICE 'PASS  T5a reward_given flipped to true after first post';
  ELSE
    RAISE EXCEPTION 'FAIL  T5a expected reward_given=true, got: %', v_rw_given;
  END IF;

  SELECT balance INTO v_balance
  FROM public.credits_balance
  WHERE user_id = v_referrer_id;

  IF v_balance = 150 THEN
    RAISE NOTICE 'PASS  T5b referrer received +50cr (100 → 150)';
  ELSE
    RAISE EXCEPTION 'FAIL  T5b expected 150cr, got: %', v_balance;
  END IF;

  -- ════════════════════════════════════════════════════════════════════════════
  -- TEST 6 — second post: no double reward
  -- ════════════════════════════════════════════════════════════════════════════
  INSERT INTO public.posts (id, user_id, text, post_type, status)
  VALUES (gen_random_uuid(), v_referred_id, 'Second post', 'social_post', 'active');

  SELECT balance INTO v_balance
  FROM public.credits_balance
  WHERE user_id = v_referrer_id;

  IF v_balance = 150 THEN
    RAISE NOTICE 'PASS  T6  no double reward on second post (still 150cr)';
  ELSE
    RAISE EXCEPTION 'FAIL  T6  expected 150cr still, got: %', v_balance;
  END IF;

  -- ════════════════════════════════════════════════════════════════════════════
  -- TEST 7 — existing rewarded referral: backfilled row is never re-rewarded
  -- ════════════════════════════════════════════════════════════════════════════
  -- Simulate a pre-migration row: reward_given=true, rewarded_at already set
  INSERT INTO public.referrals (referrer_id, referred_id, reward_given, rewarded_at)
  VALUES (v_referrer_id, v_referred2_id, true, now() - INTERVAL '1 hour');

  UPDATE public.credits_balance SET balance = 200 WHERE user_id = v_referrer_id;

  -- Calling the function directly on an already-rewarded user → noop
  PERFORM public.grant_referral_reward_if_eligible(v_referred2_id);

  SELECT balance INTO v_balance
  FROM public.credits_balance
  WHERE user_id = v_referrer_id;

  IF v_balance = 200 THEN
    RAISE NOTICE 'PASS  T7  pre-existing rewarded referral not double-rewarded';
  ELSE
    RAISE EXCEPTION 'FAIL  T7  expected 200cr unchanged, got: %', v_balance;
  END IF;

  -- ════════════════════════════════════════════════════════════════════════════
  -- TEST 8 — daily cap: 6th referral in 24h is blocked
  -- ════════════════════════════════════════════════════════════════════════════
  -- Use referrer2 so we don't pollute referrer's state
  -- Create 5 referral rows already rewarded today
  FOR i IN 1..5 LOOP
    v_extra_usr_id := gen_random_uuid();
    INSERT INTO public.profiles (id, username, full_name)
    VALUES (v_extra_usr_id, '_cap_test_' || i, 'Cap Test ' || i);

    INSERT INTO public.credits_balance (user_id, balance) VALUES (v_extra_usr_id, 0);

    INSERT INTO public.referrals (referrer_id, referred_id, reward_given, rewarded_at)
    VALUES (v_referrer2_id, v_extra_usr_id, true, now() - INTERVAL '1 hour');
  END LOOP;

  UPDATE public.credits_balance SET balance = 500 WHERE user_id = v_referrer2_id;

  -- Now set up a 6th pending referral for referrer2
  v_extra_ref_id := gen_random_uuid();
  INSERT INTO public.profiles (id, username, full_name)
  VALUES (v_extra_ref_id, '_cap_test_6', 'Cap Test 6');
  INSERT INTO public.credits_balance (user_id, balance) VALUES (v_extra_ref_id, 0);

  INSERT INTO public.referrals (referrer_id, referred_id, reward_given)
  VALUES (v_referrer2_id, v_extra_ref_id, false);

  -- First post for the 6th referred user → should be blocked by daily cap
  INSERT INTO public.posts (id, user_id, text, post_type, status)
  VALUES (gen_random_uuid(), v_extra_ref_id, 'Cap post', 'social_post', 'active');

  SELECT balance INTO v_balance
  FROM public.credits_balance
  WHERE user_id = v_referrer2_id;

  IF v_balance = 500 THEN
    RAISE NOTICE 'PASS  T8  daily cap (5/day) blocks 6th reward (balance still 500cr)';
  ELSE
    RAISE EXCEPTION 'FAIL  T8  expected 500cr (capped), got: %', v_balance;
  END IF;

  -- Verify the referral row was NOT flipped (reward deferred, not lost)
  SELECT reward_given INTO v_rw_given
  FROM public.referrals
  WHERE referred_id = v_extra_ref_id;

  IF v_rw_given = false THEN
    RAISE NOTICE 'PASS  T8b cap: reward_given stays false (deferred, not lost)';
  ELSE
    RAISE EXCEPTION 'FAIL  T8b expected reward_given=false (deferred), got: %', v_rw_given;
  END IF;

  -- ════════════════════════════════════════════════════════════════════════════
  -- TEST 9 — concurrent simulation: call grant_referral_reward_if_eligible
  --           twice serially for the same user (mimics two triggers completing
  --           sequentially after a lock release)
  -- ════════════════════════════════════════════════════════════════════════════
  -- T5 already rewarded v_referred_id's referral. Call again → should noop.
  UPDATE public.credits_balance SET balance = 300 WHERE user_id = v_referrer_id;

  PERFORM public.grant_referral_reward_if_eligible(v_referred_id);

  SELECT balance INTO v_balance
  FROM public.credits_balance
  WHERE user_id = v_referrer_id;

  IF v_balance = 300 THEN
    RAISE NOTICE 'PASS  T9  concurrent-safe: second call noop (reward_given=true re-eval)';
  ELSE
    RAISE EXCEPTION 'FAIL  T9  expected 300cr (no double reward), got: %', v_balance;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE 'All referral anti-abuse tests passed.';
  RAISE NOTICE '══════════════════════════════════════════';

END;
$$;

ROLLBACK;
