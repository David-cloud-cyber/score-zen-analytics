CREATE TABLE IF NOT EXISTS public.app_error_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id TEXT NOT NULL,
  route TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('data', 'route', 'render', 'css', 'provider', 'timeout', 'quota', 'payment')),
  status_code INTEGER NOT NULL DEFAULT 500 CHECK (status_code BETWEEN 0 AND 599),
  device_family TEXT NOT NULL DEFAULT 'desktop' CHECK (device_family IN ('mobile', 'tablet', 'desktop')),
  browser_family TEXT NOT NULL DEFAULT 'unknown',
  deployment_version TEXT NOT NULL DEFAULT 'unknown',
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  cache_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_error_events_created ON public.app_error_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_error_events_category ON public.app_error_events(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_error_events_route ON public.app_error_events(route, created_at DESC);

ALTER TABLE public.app_error_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_error_events FROM anon, authenticated;
GRANT ALL ON public.app_error_events TO service_role;
