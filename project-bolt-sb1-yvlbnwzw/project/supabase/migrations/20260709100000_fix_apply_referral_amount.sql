-- Fix apply_referral: use earn_reward() instead of hardcoded +25
-- Previously bypassed earn_reward and always gave 25 credits directly.
-- Now uses earn_reward('referral') which gives 20 credits consistently.

CREATE OR REPLACE FUNCTION public.apply_referral(p_referred_id uuid, p_referral_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_referrer_id uuid;
  v_already boolean;
BEGIN
  SELECT id INTO v_referrer_id FROM profiles WHERE referral_code = p_referral_code;
  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  IF v_referrer_id = p_referred_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self_referral');
  END IF;

  SELECT EXISTS(SELECT 1 FROM referrals WHERE referred_id = p_referred_id) INTO v_already;
  IF v_already THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_applied');
  END IF;

  INSERT INTO referrals (referrer_id, referred_id, reward_given)
  VALUES (v_referrer_id, p_referred_id, true);

  UPDATE profiles SET referred_by = v_referrer_id WHERE id = p_referred_id;

  PERFORM public.earn_reward(v_referrer_id, 'referral');

  RETURN jsonb_build_object('ok', true, 'referrer_id', v_referrer_id);
END;
$function$;
