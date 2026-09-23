-- Campagne découverte temporaire : offre par compte, idempotence stricte,
-- notifications plafonnées et abonnements Web Push opt-in.

CREATE TABLE IF NOT EXISTS public.promo_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_xaf INTEGER NOT NULL CHECK (price_xaf > 0),
  credits INTEGER NOT NULL CHECK (credits > 0),
  duration_days INTEGER NOT NULL CHECK (duration_days BETWEEN 1 AND 31),
  welcome_credits INTEGER NOT NULL DEFAULT 5 CHECK (welcome_credits >= 0),
  notifications_per_day INTEGER NOT NULL DEFAULT 3 CHECK (notifications_per_day BETWEEN 0 AND 3),
  active BOOLEAN NOT NULL DEFAULT false,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stopped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promo_user_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.promo_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  eligible_from TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'eligible' CHECK (status IN ('eligible', 'pending', 'purchased', 'expired', 'paused')),
  purchase_payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  purchased_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.promo_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.promo_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  promo_day INTEGER NOT NULL CHECK (promo_day BETWEEN 1 AND 31),
  slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 3),
  variant TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT NOT NULL DEFAULT '/premium',
  internal_sent_at TIMESTAMPTZ,
  push_sent_at TIMESTAMPTZ,
  push_clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, user_id, promo_day, slot)
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  content_encoding TEXT NOT NULL DEFAULT 'aes128gcm',
  device_family TEXT NOT NULL DEFAULT 'mobile' CHECK (device_family IN ('mobile', 'tablet', 'desktop')),
  active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

CREATE TABLE IF NOT EXISTS public.credit_grant_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grant_key TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, grant_key)
);

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS promo_campaign_id UUID REFERENCES public.promo_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promo_user_state_id UUID REFERENCES public.promo_user_states(id) ON DELETE SET NULL;

ALTER TABLE public.user_notifications DROP CONSTRAINT IF EXISTS user_notifications_type_check;
ALTER TABLE public.user_notifications ADD CONSTRAINT user_notifications_type_check
  CHECK (type IN ('community_reply', 'support_reply', 'vip_status', 'editorial_reply', 'editorial_moderation', 'promo_campaign', 'system'));

CREATE INDEX IF NOT EXISTS promo_states_active_idx
  ON public.promo_user_states (campaign_id, status, expires_at);
CREATE INDEX IF NOT EXISTS promo_states_user_idx
  ON public.promo_user_states (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS promo_notification_due_idx
  ON public.promo_notification_log (campaign_id, user_id, promo_day, slot);
CREATE INDEX IF NOT EXISTS push_subscriptions_active_idx
  ON public.push_subscriptions (active, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS credit_grant_events_source_idx
  ON public.credit_grant_events (source, created_at DESC);

ALTER TABLE public.promo_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_user_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_grant_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.promo_campaigns, public.promo_user_states, public.promo_notification_log, public.push_subscriptions, public.credit_grant_events FROM anon, authenticated;
GRANT ALL ON public.promo_campaigns, public.promo_user_states, public.promo_notification_log, public.push_subscriptions, public.credit_grant_events TO service_role;

-- La campagne est activée à l'application de la migration. Sa durée est
-- individuelle : les comptes existants démarrent au lancement, les nouveaux
-- comptes au moment de leur inscription tant que la campagne reste active.
INSERT INTO public.promo_campaigns (
  slug, name, price_xaf, credits, duration_days, welcome_credits,
  notifications_per_day, active, starts_at
)
VALUES (
  'decouverte-500-xaf', 'Offre découverte', 500, 15, 7, 5, 3, true, now()
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.promo_user_states (campaign_id, user_id, eligible_from, expires_at)
SELECT c.id,
       p.id,
       CASE WHEN p.created_at < c.starts_at THEN c.starts_at ELSE p.created_at END,
       CASE WHEN p.created_at < c.starts_at
            THEN c.starts_at + make_interval(days => c.duration_days)
            ELSE p.created_at + make_interval(days => c.duration_days)
       END
FROM public.promo_campaigns c
JOIN public.profiles p ON true
WHERE c.slug = 'decouverte-500-xaf'
ON CONFLICT (campaign_id, user_id) DO NOTHING;

-- Garantit le bonus d'inscription sans dépendre d'un refresh ou d'une
-- reconnexion. Le ledger reste la source visible de chaque attribution.
CREATE OR REPLACE FUNCTION public.grant_welcome_credits_once(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  inserted_id UUID;
  balance INTEGER;
BEGIN
  INSERT INTO public.credit_grant_events(user_id, grant_key, amount, source)
  VALUES (p_user_id, 'welcome-credits-v1', 5, 'welcome')
  ON CONFLICT (user_id, grant_key) DO NOTHING
  RETURNING id INTO inserted_id;
  IF inserted_id IS NULL THEN RETURN 0; END IF;

  UPDATE public.profiles SET credits = credits + 5 WHERE id = p_user_id RETURNING credits INTO balance;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;
  INSERT INTO public.credits_ledger(user_id, kind, amount, balance_after, label, meta)
  VALUES (p_user_id, 'bonus', 5, balance, 'Crédits de bienvenue', jsonb_build_object('grant_key', 'welcome-credits-v1'));
  RETURN 5;
END;
$$;

-- Recrée le trigger d'inscription avec un profil initial à 0, puis une seule
-- attribution atomique de 5 crédits.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  init_name TEXT;
BEGIN
  init_name := coalesce(
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)
  );
  INSERT INTO public.profiles (id, credits, plan, display_name, avatar_url)
  VALUES (new.id, 0, 'free', init_name, new.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles(user_id, role) VALUES (new.id, 'user') ON CONFLICT DO NOTHING;
  PERFORM public.grant_welcome_credits_once(new.id);
  INSERT INTO public.promo_user_states (campaign_id, user_id, eligible_from, expires_at)
  SELECT id, new.id, now(), now() + make_interval(days => duration_days)
  FROM public.promo_campaigns WHERE active = true AND starts_at <= now();
  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_welcome_credits_once(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_welcome_credits_once(UUID) TO service_role;

-- Règlement atomique du pack promotionnel : le paiement, le ledger et l'état
-- de campagne sont modifiés dans la même transaction.
CREATE OR REPLACE FUNCTION public.credit_promotional_payment(
  p_payment_id UUID, p_user_id UUID, p_credits INTEGER
)
RETURNS TABLE (credited BOOLEAN, new_balance INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
  v_state public.promo_user_states%ROWTYPE;
BEGIN
  SELECT s.* INTO v_state FROM public.promo_user_states s
  JOIN public.payments p ON p.promo_user_state_id = s.id
  WHERE p.id = p_payment_id AND p.user_id = p_user_id
  FOR UPDATE OF s, p;
  IF NOT FOUND OR v_state.status = 'purchased' OR p_credits <= 0 THEN
    SELECT credits INTO v_balance FROM public.profiles WHERE id = p_user_id;
    RETURN QUERY SELECT false, coalesce(v_balance, 0); RETURN;
  END IF;

  UPDATE public.payments
  SET status = 'SUCCESSFUL', credited_at = now()
  WHERE id = p_payment_id AND user_id = p_user_id AND promo_campaign_id IS NOT NULL AND credited_at IS NULL;
  IF NOT FOUND THEN
    SELECT credits INTO v_balance FROM public.profiles WHERE id = p_user_id;
    RETURN QUERY SELECT false, coalesce(v_balance, 0); RETURN;
  END IF;

  UPDATE public.profiles SET credits = credits + p_credits WHERE id = p_user_id RETURNING credits INTO v_balance;
  UPDATE public.promo_user_states SET status = 'purchased', purchased_at = now(), purchase_payment_id = p_payment_id WHERE id = v_state.id;
  INSERT INTO public.credits_ledger(user_id, kind, amount, balance_after, label, meta)
  VALUES (p_user_id, 'topup', p_credits, v_balance, 'Offre découverte — 15 crédits', jsonb_build_object('campaign_id', v_state.campaign_id, 'payment_id', p_payment_id));
  RETURN QUERY SELECT true, v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_promotional_payment(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_promotional_payment(UUID, UUID, INTEGER) TO service_role;
