-- Métadonnées minimales pour piloter l'audience côté administration.
-- Le pays est une estimation issue du navigateur (pas une géolocalisation GPS
-- ni une adresse IP) et reste privé, réservé aux admins/owners.

ALTER TABLE public.user_presence
  ADD COLUMN IF NOT EXISTS country_code TEXT,
  ADD COLUMN IF NOT EXISTS locale TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_presence_country_code_check'
      AND conrelid = 'public.user_presence'::regclass
  ) THEN
    ALTER TABLE public.user_presence
      ADD CONSTRAINT user_presence_country_code_check
      CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS user_presence_country_idx
  ON public.user_presence (country_code, last_seen_at DESC);

-- La publication ne contient que la ligne de présence déjà protégée par RLS.
-- Les agrégats affichés au panel sont toujours calculés côté serveur.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_presence'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
  END IF;
END $$;
