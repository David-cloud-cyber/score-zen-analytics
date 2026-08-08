-- Atomic, server-only credit operations.
-- These functions are intentionally callable only by service_role.

CREATE OR REPLACE FUNCTION public.consume_analysis_credit(
  p_user_id UUID,
  p_cost INTEGER,
  p_home_team TEXT,
  p_away_team TEXT,
  p_match_id TEXT,
  p_result JSONB
)
RETURNS TABLE (analysis_id UUID, new_balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
  v_analysis_id UUID;
BEGIN
  IF p_cost <= 0 OR p_home_team IS NULL OR p_away_team IS NULL OR p_result IS NULL THEN
    RAISE EXCEPTION 'INVALID_ANALYSIS_CREDIT_REQUEST';
  END IF;

  UPDATE public.profiles
  SET credits = credits - p_cost
  WHERE id = p_user_id AND credits >= p_cost
  RETURNING credits INTO v_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
  END IF;

  INSERT INTO public.ai_analyses (user_id, home_team, away_team, match_id, result)
  VALUES (p_user_id, p_home_team, p_away_team, p_match_id, p_result)
  RETURNING id INTO v_analysis_id;

  INSERT INTO public.credits_ledger (user_id, kind, amount, balance_after, label)
  VALUES (p_user_id, 'analysis', -p_cost, v_balance, 'Analyse ' || p_home_team || ' vs ' || p_away_team);

  RETURN QUERY SELECT v_analysis_id, v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_payment(
  p_payment_id UUID,
  p_user_id UUID,
  p_credits INTEGER
)
RETURNS TABLE (credited BOOLEAN, new_balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  IF p_credits <= 0 THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_CREDIT_REQUEST';
  END IF;

  UPDATE public.payments
  SET status = 'SUCCESSFUL', credited_at = now()
  WHERE id = p_payment_id
    AND user_id = p_user_id
    AND credited_at IS NULL
    AND credits = p_credits;

  IF NOT FOUND THEN
    SELECT credits INTO v_balance FROM public.profiles WHERE id = p_user_id;
    RETURN QUERY SELECT FALSE, COALESCE(v_balance, 0);
    RETURN;
  END IF;

  UPDATE public.profiles
  SET credits = credits + p_credits
  WHERE id = p_user_id
  RETURNING credits INTO v_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  INSERT INTO public.credits_ledger (user_id, kind, amount, balance_after, label)
  VALUES (p_user_id, 'topup', p_credits, v_balance, 'Recharge ' || p_credits || ' crédits');

  RETURN QUERY SELECT TRUE, v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_subscription(
  p_subscription_id UUID,
  p_user_id UUID,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ,
  p_plan_id TEXT
)
RETURNS TABLE (activated BOOLEAN, new_balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  UPDATE public.subscriptions
  SET status = 'ACTIVE',
      current_period_start = p_period_start,
      current_period_end = p_period_end
  WHERE id = p_subscription_id
    AND user_id = p_user_id
    AND status <> 'ACTIVE';

  IF NOT FOUND THEN
    SELECT credits INTO v_balance FROM public.profiles WHERE id = p_user_id;
    RETURN QUERY SELECT FALSE, COALESCE(v_balance, 0);
    RETURN;
  END IF;

  UPDATE public.profiles
  SET plan = 'premium', premium_until = p_period_end, credits = 100
  WHERE id = p_user_id
  RETURNING credits INTO v_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  INSERT INTO public.credits_ledger (user_id, kind, amount, balance_after, label)
  VALUES (p_user_id, 'subscription', 100, v_balance, 'Abonnement ' || COALESCE(p_plan_id, 'Premium') || ' (100 crédits)');

  RETURN QUERY SELECT TRUE, v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_analysis_credit(UUID, INTEGER, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_payment(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activate_subscription(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_analysis_credit(UUID, INTEGER, TEXT, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_payment(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_subscription(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO service_role;

-- Keep the existing referral helper safe when it is invoked by a trigger.
ALTER FUNCTION public.generate_referral_code() SET search_path = public;
