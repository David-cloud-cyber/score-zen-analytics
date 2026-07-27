-- App-level config/secrets table — readable by anon (for server-side fetching),
-- writable only by service_role. Secrets like APIFOOTBALL_KEY live here.

CREATE TABLE IF NOT EXISTS public.app_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read" ON public.app_config
  FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.app_config TO anon, authenticated;
GRANT ALL    ON public.app_config TO service_role;
