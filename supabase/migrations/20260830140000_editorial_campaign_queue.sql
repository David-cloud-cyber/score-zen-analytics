-- File éditoriale durable : les briefs sont séparés des articles publiés.
-- La campagne reste limitée à trois publications par jour pour protéger la qualité SEO.

CREATE TABLE IF NOT EXISTS public.editorial_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  daily_limit INTEGER NOT NULL DEFAULT 3 CHECK (daily_limit BETWEEN 0 AND 3),
  max_articles INTEGER NOT NULL DEFAULT 90 CHECK (max_articles BETWEEN 0 AND 90),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.editorial_campaign_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.editorial_campaigns(id) ON DELETE CASCADE,
  topic_key TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('actualites', 'competitions', 'forme', 'analyse', 'guides')),
  query_terms JSONB NOT NULL DEFAULT '[]'::jsonb,
  trend_score NUMERIC(8, 2) NOT NULL DEFAULT 0,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'generating', 'validated', 'published', 'rejected', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  article_id UUID REFERENCES public.editorial_articles(id) ON DELETE SET NULL,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, topic_key)
);

CREATE INDEX IF NOT EXISTS editorial_campaign_queue_due_idx
  ON public.editorial_campaign_queue (campaign_id, status, scheduled_for);
CREATE INDEX IF NOT EXISTS editorial_campaign_queue_article_idx
  ON public.editorial_campaign_queue (article_id);

ALTER TABLE public.editorial_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editorial_campaign_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.editorial_campaigns, public.editorial_campaign_queue FROM anon, authenticated;
GRANT ALL ON public.editorial_campaigns, public.editorial_campaign_queue TO service_role;

INSERT INTO public.editorial_campaigns (slug, name, starts_at, ends_at, daily_limit, max_articles, active)
VALUES (
  'football-30-jours-2026',
  'Football utile — campagne 30 jours',
  now(),
  now() + INTERVAL '30 days',
  3,
  90,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  daily_limit = LEAST(public.editorial_campaigns.daily_limit, 3),
  max_articles = LEAST(public.editorial_campaigns.max_articles, 90),
  updated_at = now();
