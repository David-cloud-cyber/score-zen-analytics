-- Web Push marketing opt-in. No browser can be subscribed without an explicit
-- permission grant. Deliveries are idempotent per campaign/user/day.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  content_encoding TEXT NOT NULL DEFAULT 'aes128gcm',
  device_family TEXT NOT NULL DEFAULT 'desktop' CHECK (device_family IN ('mobile', 'tablet', 'desktop')),
  active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

CREATE TABLE IF NOT EXISTS public.marketing_push_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 80),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 10 AND 180),
  link TEXT NOT NULL DEFAULT '/',
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'free', 'premium')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  daily_limit INTEGER NOT NULL DEFAULT 1 CHECK (daily_limit BETWEEN 1 AND 2),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  last_dispatched_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.marketing_push_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.marketing_push_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.push_subscriptions(id) ON DELETE SET NULL,
  delivery_day DATE NOT NULL DEFAULT CURRENT_DATE,
  click_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'clicked')),
  sent_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, user_id, delivery_day)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_active_user_idx ON public.push_subscriptions (active, user_id);
CREATE INDEX IF NOT EXISTS marketing_push_campaigns_due_idx ON public.marketing_push_campaigns (status, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS marketing_push_deliveries_campaign_idx ON public.marketing_push_deliveries (campaign_id, created_at DESC);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_push_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_push_deliveries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.push_subscriptions, public.marketing_push_campaigns, public.marketing_push_deliveries FROM anon, authenticated;
GRANT ALL ON public.push_subscriptions, public.marketing_push_campaigns, public.marketing_push_deliveries TO service_role;

