-- Editorial content model for the public football blog and the admin queue.
CREATE TABLE IF NOT EXISTS public.editorial_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  normalized_key TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'football',
  trend_score NUMERIC(8, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'detected'
    CHECK (status IN ('detected', 'selected', 'used', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.editorial_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.editorial_topics(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'football',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'validated', 'scheduled', 'published', 'rejected', 'failed')),
  title TEXT NOT NULL,
  seo_title TEXT NOT NULL,
  seo_description TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  direct_answer TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  internal_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  quality_score NUMERIC(5, 2),
  word_count INTEGER NOT NULL DEFAULT 0,
  author_name TEXT NOT NULL DEFAULT 'Rédaction LiveFoot',
  cover_image TEXT,
  disclosure TEXT,
  rejection_reason TEXT,
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.editorial_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.editorial_topics(id) ON DELETE CASCADE,
  article_id UUID REFERENCES public.editorial_articles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  publisher TEXT NOT NULL,
  excerpt TEXT,
  published_at TIMESTAMPTZ,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_verified BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (article_id, url)
);

CREATE TABLE IF NOT EXISTS public.editorial_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_key TEXT UNIQUE,
  run_type TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (run_type IN ('scheduled', 'manual', 'discovery', 'generation', 'validation')),
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'skipped', 'failed')),
  articles_created INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS editorial_articles_public_idx
  ON public.editorial_articles (status, published_at DESC);
CREATE INDEX IF NOT EXISTS editorial_articles_category_idx
  ON public.editorial_articles (category, published_at DESC);
CREATE INDEX IF NOT EXISTS editorial_sources_article_idx
  ON public.editorial_sources (article_id, published_at DESC);
CREATE INDEX IF NOT EXISTS editorial_topics_status_idx
  ON public.editorial_topics (status, trend_score DESC, created_at DESC);

ALTER TABLE public.editorial_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editorial_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editorial_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editorial_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.editorial_topics FROM anon, authenticated;
REVOKE ALL ON public.editorial_runs FROM anon, authenticated;
REVOKE ALL ON public.editorial_articles FROM anon, authenticated;
REVOKE ALL ON public.editorial_sources FROM anon, authenticated;
GRANT SELECT ON public.editorial_articles TO anon, authenticated;
GRANT SELECT ON public.editorial_sources TO anon, authenticated;
GRANT ALL ON public.editorial_topics, public.editorial_articles, public.editorial_sources, public.editorial_runs TO service_role;

DROP POLICY IF EXISTS "Published editorial articles are public" ON public.editorial_articles;
CREATE POLICY "Published editorial articles are public"
  ON public.editorial_articles FOR SELECT TO anon, authenticated
  USING (status = 'published' AND published_at IS NOT NULL AND published_at <= now());

DROP POLICY IF EXISTS "Sources of published articles are public" ON public.editorial_sources;
CREATE POLICY "Sources of published articles are public"
  ON public.editorial_sources FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.editorial_articles article
    WHERE article.id = editorial_sources.article_id
      AND article.status = 'published'
      AND article.published_at IS NOT NULL
      AND article.published_at <= now()
  ));
