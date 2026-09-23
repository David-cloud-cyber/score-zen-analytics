-- Parrainage Pro : une attribution est validée uniquement après confirmation
-- du compte du filleul. Les crédits et paliers sont réglés côté base pour
-- rester idempotents en cas de refresh, de plusieurs appareils ou de retries.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_pro_until TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.referral_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'qualified', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  qualified_at TIMESTAMPTZ,
  credit_granted_at TIMESTAMPTZ,
  UNIQUE (referred_id),
  CHECK (referrer_id <> referred_id)
);

CREATE TABLE IF NOT EXISTS public.referral_milestone_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone INTEGER NOT NULL CHECK (milestone > 0),
  qualified_referral_count INTEGER NOT NULL CHECK (qualified_referral_count = milestone * 25),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (referrer_id, milestone)
);

CREATE INDEX IF NOT EXISTS referral_attributions_referrer_status_idx
  ON public.referral_attributions (referrer_id, status, qualified_at DESC);
CREATE INDEX IF NOT EXISTS referral_attributions_pending_idx
  ON public.referral_attributions (status, created_at);
CREATE INDEX IF NOT EXISTS referral_milestones_referrer_idx
  ON public.referral_milestone_rewards (referrer_id, milestone DESC);

ALTER TABLE public.referral_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_milestone_rewards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.referral_attributions, public.referral_milestone_rewards FROM anon, authenticated;
GRANT ALL ON public.referral_attributions, public.referral_milestone_rewards TO service_role;

-- Crée les paliers manquants. L'accès existant n'est jamais écourté : les sept
-- jours sont ajoutés après la date Premium la plus éloignée.
CREATE OR REPLACE FUNCTION public.reconcile_referral_milestones(p_referrer_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_count INTEGER;
  v_milestone INTEGER;
  v_reward referral_milestone_rewards%ROWTYPE;
  v_current_until TIMESTAMPTZ;
  v_effective_start TIMESTAMPTZ;
  v_effective_end TIMESTAMPTZ;
  v_granted INTEGER := 0;
BEGIN
  SELECT count(*)::INTEGER INTO v_count
  FROM public.referral_attributions
  WHERE referrer_id = p_referrer_id AND status = 'qualified';

  IF v_count < 25 THEN
    RETURN 0;
  END IF;

  FOR v_milestone IN 1..floor(v_count / 25.0)::INTEGER LOOP
    SELECT premium_until INTO v_current_until
    FROM public.profiles
    WHERE id = p_referrer_id
    FOR UPDATE;

    v_effective_start := GREATEST(COALESCE(v_current_until, now()), now());
    v_effective_end := v_effective_start + interval '7 days';

    INSERT INTO public.referral_milestone_rewards (
      referrer_id, milestone, qualified_referral_count, starts_at, ends_at
    ) VALUES (
      p_referrer_id, v_milestone, v_milestone * 25, now(), v_effective_end
    )
    ON CONFLICT (referrer_id, milestone) DO NOTHING
    RETURNING * INTO v_reward;

    IF v_reward.id IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE public.profiles
    SET plan = 'premium',
        premium_until = v_effective_end,
        referral_pro_until = GREATEST(COALESCE(referral_pro_until, now()), now()) + interval '7 days'
    WHERE id = p_referrer_id;

    INSERT INTO public.user_notifications (user_id, type, title, message, link, entity_id)
    VALUES (
      p_referrer_id,
      'system',
      'Premium Pro activé pendant 7 jours',
      format('Vous avez atteint %s invitations confirmées. Votre accès Premium Pro est actif.', v_milestone * 25),
      '/premium/tableau-de-bord',
      v_reward.id
    );
    v_granted := v_granted + 1;
  END LOOP;

  RETURN v_granted;
END;
$$;

-- Enregistre le choix de parrainage sans donner d'avantage avant la
-- confirmation. Le lien ne peut jamais être appliqué à son propre compte.
CREATE OR REPLACE FUNCTION public.record_referral_attribution(
  p_referred_id UUID,
  p_referral_code TEXT
)
RETURNS TABLE (ok BOOLEAN, reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_referrer_id UUID;
  v_existing referral_attributions%ROWTYPE;
BEGIN
  SELECT id INTO v_referrer_id
  FROM public.profiles
  WHERE referral_code = upper(trim(p_referral_code));

  IF v_referrer_id IS NULL THEN RETURN QUERY SELECT false, 'invalid_code'; RETURN; END IF;
  IF v_referrer_id = p_referred_id THEN RETURN QUERY SELECT false, 'self_referral'; RETURN; END IF;

  SELECT * INTO v_existing
  FROM public.referral_attributions
  WHERE referred_id = p_referred_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.referrer_id = v_referrer_id THEN
      RETURN QUERY SELECT true, v_existing.status;
    ELSE
      RETURN QUERY SELECT false, 'already_referred';
    END IF;
    RETURN;
  END IF;

  INSERT INTO public.referral_attributions (referrer_id, referred_id, referral_code)
  VALUES (v_referrer_id, p_referred_id, upper(trim(p_referral_code)));
  RETURN QUERY SELECT true, 'pending';
END;
$$;

-- Qualifie une attribution seulement si le compte est réellement confirmé.
CREATE OR REPLACE FUNCTION public.qualify_referral_for_user(p_referred_id UUID)
RETURNS TABLE (qualified BOOLEAN, reason TEXT, rewards_granted INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_attribution referral_attributions%ROWTYPE;
  v_confirmed_at TIMESTAMPTZ;
  v_balance INTEGER;
  v_rewards INTEGER := 0;
BEGIN
  SELECT * INTO v_attribution
  FROM public.referral_attributions
  WHERE referred_id = p_referred_id
  FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 'no_referral', 0; RETURN; END IF;
  IF v_attribution.status = 'qualified' THEN RETURN QUERY SELECT true, 'already_qualified', 0; RETURN; END IF;
  IF v_attribution.status = 'rejected' THEN RETURN QUERY SELECT false, 'rejected', 0; RETURN; END IF;

  SELECT email_confirmed_at INTO v_confirmed_at FROM auth.users WHERE id = p_referred_id;
  IF v_confirmed_at IS NULL THEN RETURN QUERY SELECT false, 'email_unconfirmed', 0; RETURN; END IF;

  UPDATE public.referral_attributions
  SET status = 'qualified', qualified_at = now(), credit_granted_at = now()
  WHERE id = v_attribution.id AND status = 'pending';
  IF NOT FOUND THEN RETURN QUERY SELECT false, 'already_processed', 0; RETURN; END IF;

  UPDATE public.profiles
  SET referred_by = v_attribution.referrer_id
  WHERE id = p_referred_id AND referred_by IS NULL;

  UPDATE public.profiles
  SET credits = credits + 5
  WHERE id = v_attribution.referrer_id
  RETURNING credits INTO v_balance;

  INSERT INTO public.credits_ledger (user_id, kind, amount, balance_after, label, meta)
  VALUES (
    v_attribution.referrer_id,
    'bonus',
    5,
    v_balance,
    'Parrainage — compte confirmé',
    jsonb_build_object('referred_id', p_referred_id, 'attribution_id', v_attribution.id)
  );

  v_rewards := public.reconcile_referral_milestones(v_attribution.referrer_id);
  RETURN QUERY SELECT true, 'qualified', v_rewards;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_referral_milestones(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_referral_attribution(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.qualify_referral_for_user(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_referral_attribution(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.qualify_referral_for_user(UUID) TO service_role;

-- Les relations historiques déjà attribuées sont reprises uniquement lorsque
-- l'adresse email du filleul est confirmée. Elles ne reçoivent pas une seconde
-- fois les 5 crédits ; seuls les paliers Premium manquants sont régularisés.
INSERT INTO public.referral_attributions (
  referrer_id, referred_id, referral_code, status, created_at, qualified_at, credit_granted_at
)
SELECT
  p.referred_by,
  p.id,
  coalesce(r.referral_code, 'HISTORICAL'),
  'qualified',
  p.created_at,
  p.created_at,
  p.created_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.id AND u.email_confirmed_at IS NOT NULL
LEFT JOIN public.profiles r ON r.id = p.referred_by
WHERE p.referred_by IS NOT NULL
ON CONFLICT (referred_id) DO NOTHING;

DO $$
DECLARE item RECORD;
BEGIN
  FOR item IN
    SELECT DISTINCT referrer_id FROM public.referral_attributions WHERE status = 'qualified'
  LOOP
    PERFORM public.reconcile_referral_milestones(item.referrer_id);
  END LOOP;
END;
$$;
