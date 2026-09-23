-- Programme LiveFoot Ambassadeurs.
-- Les commissions sont créées exclusivement à partir d'un abonnement Premium
-- réellement activé. Elles restent idempotentes grâce à l'unicité sur la
-- souscription et ne sont jamais calculées dans le navigateur.

CREATE TABLE IF NOT EXISTS public.affiliate_program_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  tier_25_min_active INTEGER NOT NULL DEFAULT 1 CHECK (tier_25_min_active >= 1),
  tier_30_min_active INTEGER NOT NULL DEFAULT 25 CHECK (tier_30_min_active >= 1),
  tier_35_min_active INTEGER NOT NULL DEFAULT 50 CHECK (tier_35_min_active >= 1),
  tier_40_min_active INTEGER NOT NULL DEFAULT 100 CHECK (tier_40_min_active >= 1),
  tier_25_rate_bps INTEGER NOT NULL DEFAULT 2500 CHECK (tier_25_rate_bps BETWEEN 0 AND 10000),
  tier_30_rate_bps INTEGER NOT NULL DEFAULT 3000 CHECK (tier_30_rate_bps BETWEEN 0 AND 10000),
  tier_35_rate_bps INTEGER NOT NULL DEFAULT 3500 CHECK (tier_35_rate_bps BETWEEN 0 AND 10000),
  tier_40_rate_bps INTEGER NOT NULL DEFAULT 4000 CHECK (tier_40_rate_bps BETWEEN 0 AND 10000),
  tier_grace_days INTEGER NOT NULL DEFAULT 60 CHECK (tier_grace_days BETWEEN 0 AND 365),
  commission_hold_days INTEGER NOT NULL DEFAULT 7 CHECK (commission_hold_days BETWEEN 0 AND 90),
  minimum_payout_xaf INTEGER NOT NULL DEFAULT 25000 CHECK (minimum_payout_xaf >= 25000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.affiliate_program_settings (id)
VALUES (TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.affiliate_tier_states (
  partner_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_paid_referrals INTEGER NOT NULL DEFAULT 0 CHECK (active_paid_referrals >= 0),
  rate_bps INTEGER NOT NULL DEFAULT 0 CHECK (rate_bps BETWEEN 0 AND 10000),
  protected_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.affiliate_payout_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payout_method TEXT NOT NULL DEFAULT 'mobile_money' CHECK (payout_method IN ('mobile_money')),
  mobile_operator TEXT NOT NULL CHECK (mobile_operator IN ('mtn', 'orange')),
  mobile_number TEXT NOT NULL CHECK (mobile_number ~ '^\+?[0-9]{8,15}$'),
  terms_accepted_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.affiliate_payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_xaf INTEGER NOT NULL CHECK (amount_xaf >= 25000),
  payout_method TEXT NOT NULL CHECK (payout_method IN ('mobile_money')),
  mobile_operator TEXT NOT NULL CHECK (mobile_operator IN ('mtn', 'orange')),
  mobile_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'paid', 'rejected', 'cancelled')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  payout_reference TEXT,
  admin_note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE RESTRICT,
  gross_amount_xaf INTEGER NOT NULL CHECK (gross_amount_xaf > 0),
  rate_bps INTEGER NOT NULL CHECK (rate_bps BETWEEN 0 AND 10000),
  amount_xaf INTEGER NOT NULL CHECK (amount_xaf > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'available', 'reserved', 'paid', 'reversed')),
  available_at TIMESTAMPTZ NOT NULL,
  payout_request_id UUID REFERENCES public.affiliate_payout_requests(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  reversed_at TIMESTAMPTZ,
  reversal_reason TEXT,
  CHECK (partner_id <> referred_id),
  UNIQUE (subscription_id)
);

CREATE INDEX IF NOT EXISTS affiliate_commissions_partner_status_idx
  ON public.affiliate_commissions (partner_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS affiliate_commissions_referred_idx
  ON public.affiliate_commissions (referred_id, created_at DESC);
CREATE INDEX IF NOT EXISTS affiliate_commissions_available_idx
  ON public.affiliate_commissions (status, available_at);
CREATE INDEX IF NOT EXISTS affiliate_payout_requests_partner_status_idx
  ON public.affiliate_payout_requests (partner_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS affiliate_payout_requests_status_idx
  ON public.affiliate_payout_requests (status, requested_at DESC);

ALTER TABLE public.affiliate_program_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_tier_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payout_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.affiliate_program_settings, public.affiliate_tier_states,
  public.affiliate_payout_profiles, public.affiliate_payout_requests,
  public.affiliate_commissions FROM anon, authenticated;
GRANT ALL ON public.affiliate_program_settings, public.affiliate_tier_states,
  public.affiliate_payout_profiles, public.affiliate_payout_requests,
  public.affiliate_commissions TO service_role;

-- Retourne et actualise le niveau courant à partir des filleuls qui ont un
-- abonnement réellement actif. Une protection de niveau évite les baisses
-- immédiates lors d'une résiliation isolée.
CREATE OR REPLACE FUNCTION public.resolve_affiliate_tier(p_partner_id UUID)
RETURNS TABLE (
  active_referrals INTEGER,
  commission_rate_bps INTEGER,
  next_threshold INTEGER,
  protected_until TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_settings public.affiliate_program_settings%ROWTYPE;
  v_active INTEGER := 0;
  v_desired_rate INTEGER := 0;
  v_effective_rate INTEGER := 0;
  v_next_threshold INTEGER := 1;
  v_state public.affiliate_tier_states%ROWTYPE;
  v_protected_until TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_settings
  FROM public.affiliate_program_settings
  WHERE id = TRUE;

  IF NOT FOUND OR NOT v_settings.enabled THEN
    RETURN QUERY SELECT 0, 0, 1, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT count(DISTINCT attribution.referred_id)::INTEGER INTO v_active
  FROM public.referral_attributions attribution
  JOIN public.subscriptions subscription
    ON subscription.user_id = attribution.referred_id
  WHERE attribution.referrer_id = p_partner_id
    AND attribution.status = 'qualified'
    AND subscription.status = 'ACTIVE'
    AND subscription.current_period_end > now();

  IF v_active >= v_settings.tier_40_min_active THEN
    v_desired_rate := v_settings.tier_40_rate_bps;
    v_next_threshold := v_settings.tier_40_min_active;
  ELSIF v_active >= v_settings.tier_35_min_active THEN
    v_desired_rate := v_settings.tier_35_rate_bps;
    v_next_threshold := v_settings.tier_40_min_active;
  ELSIF v_active >= v_settings.tier_30_min_active THEN
    v_desired_rate := v_settings.tier_30_rate_bps;
    v_next_threshold := v_settings.tier_35_min_active;
  ELSIF v_active >= v_settings.tier_25_min_active THEN
    v_desired_rate := v_settings.tier_25_rate_bps;
    v_next_threshold := v_settings.tier_30_min_active;
  ELSE
    v_desired_rate := 0;
    v_next_threshold := v_settings.tier_25_min_active;
  END IF;

  INSERT INTO public.affiliate_tier_states (
    partner_id, active_paid_referrals, rate_bps, protected_until
  ) VALUES (
    p_partner_id,
    v_active,
    v_desired_rate,
    CASE WHEN v_desired_rate > 0 THEN now() + make_interval(days => v_settings.tier_grace_days) ELSE NULL END
  )
  ON CONFLICT (partner_id) DO NOTHING;

  SELECT * INTO v_state
  FROM public.affiliate_tier_states
  WHERE partner_id = p_partner_id
  FOR UPDATE;

  IF v_desired_rate < v_state.rate_bps
    AND v_state.protected_until IS NOT NULL
    AND v_state.protected_until > now() THEN
    v_effective_rate := v_state.rate_bps;
    v_protected_until := v_state.protected_until;
  ELSE
    v_effective_rate := v_desired_rate;
    v_protected_until := CASE
      WHEN v_desired_rate > v_state.rate_bps THEN now() + make_interval(days => v_settings.tier_grace_days)
      WHEN v_desired_rate = v_state.rate_bps THEN v_state.protected_until
      ELSE NULL
    END;
  END IF;

  UPDATE public.affiliate_tier_states
  SET active_paid_referrals = v_active,
      rate_bps = v_effective_rate,
      protected_until = v_protected_until,
      updated_at = now()
  WHERE partner_id = p_partner_id;

  RETURN QUERY SELECT v_active, v_effective_rate, v_next_threshold, v_protected_until;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_affiliate_commissions(p_partner_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released INTEGER := 0;
BEGIN
  UPDATE public.affiliate_commissions
  SET status = 'available'
  WHERE partner_id = p_partner_id
    AND status = 'pending'
    AND available_at <= now();
  GET DIAGNOSTICS v_released = ROW_COUNT;
  RETURN v_released;
END;
$$;

-- Création unique d'une commission lors de chaque activation d'abonnement.
CREATE OR REPLACE FUNCTION public.record_affiliate_commission(
  p_subscription_id UUID,
  p_referred_id UUID
)
RETURNS TABLE (
  created BOOLEAN,
  commission_amount_xaf INTEGER,
  commission_rate_bps INTEGER,
  partner_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_settings public.affiliate_program_settings%ROWTYPE;
  v_referrer_id UUID;
  v_amount INTEGER;
  v_rate INTEGER;
  v_commission INTEGER;
  v_tier RECORD;
BEGIN
  SELECT * INTO v_settings FROM public.affiliate_program_settings WHERE id = TRUE;
  IF NOT FOUND OR NOT v_settings.enabled THEN
    RETURN QUERY SELECT FALSE, 0, 0, NULL::UUID;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.affiliate_commissions WHERE subscription_id = p_subscription_id) THEN
    RETURN QUERY SELECT FALSE, 0, 0, NULL::UUID;
    RETURN;
  END IF;

  SELECT referrer_id INTO v_referrer_id
  FROM public.referral_attributions
  WHERE referred_id = p_referred_id
    AND status = 'qualified';
  IF v_referrer_id IS NULL OR v_referrer_id = p_referred_id THEN
    RETURN QUERY SELECT FALSE, 0, 0, NULL::UUID;
    RETURN;
  END IF;

  SELECT amount_xaf INTO v_amount
  FROM public.subscriptions
  WHERE id = p_subscription_id
    AND user_id = p_referred_id
    AND status = 'ACTIVE';
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN QUERY SELECT FALSE, 0, 0, NULL::UUID;
    RETURN;
  END IF;

  SELECT * INTO v_tier FROM public.resolve_affiliate_tier(v_referrer_id);
  v_rate := COALESCE(v_tier.commission_rate_bps, 0);
  IF v_rate <= 0 THEN
    RETURN QUERY SELECT FALSE, 0, 0, NULL::UUID;
    RETURN;
  END IF;
  v_commission := floor(v_amount * v_rate / 10000.0)::INTEGER;
  IF v_commission <= 0 THEN
    RETURN QUERY SELECT FALSE, 0, 0, NULL::UUID;
    RETURN;
  END IF;

  INSERT INTO public.affiliate_commissions (
    partner_id, referred_id, subscription_id, gross_amount_xaf, rate_bps,
    amount_xaf, status, available_at
  ) VALUES (
    v_referrer_id, p_referred_id, p_subscription_id, v_amount, v_rate,
    v_commission, 'pending', now() + make_interval(days => v_settings.commission_hold_days)
  )
  ON CONFLICT (subscription_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 0, NULL::UUID;
    RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, v_commission, v_rate, v_referrer_id;
END;
$$;

-- Remplace la fonction d'activation existante afin que l'abonnement, les
-- crédits et l'écriture de commission restent dans une même transaction SQL.
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
  SET plan = 'premium',
      premium_until = GREATEST(COALESCE(premium_until, p_period_end), p_period_end),
      credits = 100
  WHERE id = p_user_id
  RETURNING credits INTO v_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  INSERT INTO public.credits_ledger (user_id, kind, amount, balance_after, label)
  VALUES (p_user_id, 'subscription', 100, v_balance, 'Abonnement ' || COALESCE(p_plan_id, 'Premium') || ' (100 crédits)');

  PERFORM public.record_affiliate_commission(p_subscription_id, p_user_id);

  RETURN QUERY SELECT TRUE, v_balance;
END;
$$;

-- Un retrait réserve toutes les commissions disponibles. Il est ensuite
-- validé manuellement dans l'administration avant un versement réel.
CREATE OR REPLACE FUNCTION public.request_affiliate_payout(p_partner_id UUID)
RETURNS TABLE (request_id UUID, amount_xaf INTEGER, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_settings public.affiliate_program_settings%ROWTYPE;
  v_profile public.affiliate_payout_profiles%ROWTYPE;
  v_amount INTEGER := 0;
  v_request_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_partner_id::TEXT));
  SELECT * INTO v_settings FROM public.affiliate_program_settings WHERE id = TRUE;
  IF NOT FOUND OR NOT v_settings.enabled THEN
    RAISE EXCEPTION 'AFFILIATE_PROGRAM_DISABLED';
  END IF;

  SELECT * INTO v_profile
  FROM public.affiliate_payout_profiles
  WHERE user_id = p_partner_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AFFILIATE_PAYOUT_PROFILE_REQUIRED';
  END IF;

  PERFORM public.release_affiliate_commissions(p_partner_id);
  SELECT COALESCE(sum(amount_xaf), 0)::INTEGER INTO v_amount
  FROM public.affiliate_commissions
  WHERE partner_id = p_partner_id
    AND status = 'available';

  IF v_amount < v_settings.minimum_payout_xaf THEN
    RAISE EXCEPTION 'AFFILIATE_MINIMUM_PAYOUT_NOT_REACHED';
  END IF;

  INSERT INTO public.affiliate_payout_requests (
    partner_id, amount_xaf, payout_method, mobile_operator, mobile_number
  ) VALUES (
    p_partner_id, v_amount, v_profile.payout_method, v_profile.mobile_operator, v_profile.mobile_number
  ) RETURNING id INTO v_request_id;

  UPDATE public.affiliate_commissions
  SET status = 'reserved', payout_request_id = v_request_id
  WHERE partner_id = p_partner_id
    AND status = 'available';

  RETURN QUERY SELECT v_request_id, v_amount, 'requested'::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_affiliate_payout_request(
  p_request_id UUID,
  p_status TEXT,
  p_admin_id UUID,
  p_reference TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS TABLE (ok BOOLEAN, amount_xaf INTEGER, partner_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_request public.affiliate_payout_requests%ROWTYPE;
BEGIN
  IF p_status NOT IN ('approved', 'paid', 'rejected') THEN
    RAISE EXCEPTION 'INVALID_AFFILIATE_PAYOUT_STATUS';
  END IF;

  SELECT * INTO v_request
  FROM public.affiliate_payout_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AFFILIATE_PAYOUT_REQUEST_NOT_FOUND';
  END IF;
  IF v_request.status IN ('paid', 'rejected', 'cancelled') THEN
    RETURN QUERY SELECT FALSE, v_request.amount_xaf, v_request.partner_id;
    RETURN;
  END IF;

  UPDATE public.affiliate_payout_requests
  SET status = p_status,
      reviewed_at = now(),
      reviewed_by = p_admin_id,
      payout_reference = NULLIF(trim(COALESCE(p_reference, '')), ''),
      admin_note = NULLIF(trim(COALESCE(p_note, '')), ''),
      updated_at = now()
  WHERE id = p_request_id;

  IF p_status = 'paid' THEN
    UPDATE public.affiliate_commissions
    SET status = 'paid', paid_at = now()
    WHERE payout_request_id = p_request_id
      AND status = 'reserved';
  ELSIF p_status = 'rejected' THEN
    UPDATE public.affiliate_commissions
    SET status = 'available', payout_request_id = NULL
    WHERE payout_request_id = p_request_id
      AND status = 'reserved';
  END IF;

  RETURN QUERY SELECT TRUE, v_request.amount_xaf, v_request.partner_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_affiliate_dashboard(p_partner_id UUID)
RETURNS TABLE (
  active_referrals INTEGER,
  commission_rate_bps INTEGER,
  next_threshold INTEGER,
  protected_until TIMESTAMPTZ,
  pending_xaf INTEGER,
  available_xaf INTEGER,
  reserved_xaf INTEGER,
  paid_xaf INTEGER,
  total_xaf INTEGER,
  minimum_payout_xaf INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier RECORD;
  v_settings public.affiliate_program_settings%ROWTYPE;
BEGIN
  PERFORM public.release_affiliate_commissions(p_partner_id);
  SELECT * INTO v_tier FROM public.resolve_affiliate_tier(p_partner_id);
  SELECT * INTO v_settings FROM public.affiliate_program_settings WHERE id = TRUE;

  RETURN QUERY
  SELECT
    COALESCE(v_tier.active_referrals, 0),
    COALESCE(v_tier.commission_rate_bps, 0),
    COALESCE(v_tier.next_threshold, 1),
    v_tier.protected_until,
    COALESCE(sum(CASE WHEN commission.status = 'pending' THEN commission.amount_xaf ELSE 0 END), 0)::INTEGER,
    COALESCE(sum(CASE WHEN commission.status = 'available' THEN commission.amount_xaf ELSE 0 END), 0)::INTEGER,
    COALESCE(sum(CASE WHEN commission.status = 'reserved' THEN commission.amount_xaf ELSE 0 END), 0)::INTEGER,
    COALESCE(sum(CASE WHEN commission.status = 'paid' THEN commission.amount_xaf ELSE 0 END), 0)::INTEGER,
    COALESCE(sum(commission.amount_xaf), 0)::INTEGER,
    COALESCE(v_settings.minimum_payout_xaf, 0)
  FROM public.affiliate_commissions commission
  WHERE commission.partner_id = p_partner_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_affiliate_tier(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_affiliate_commissions(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_affiliate_commission(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_affiliate_payout(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_affiliate_payout_request(UUID, TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_affiliate_dashboard(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_affiliate_tier(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_affiliate_commissions(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_affiliate_commission(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.request_affiliate_payout(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.review_affiliate_payout_request(UUID, TEXT, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_affiliate_dashboard(UUID) TO service_role;
