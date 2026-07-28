-- Migration : Système de parrainage (referral)
-- Ajoute referral_code et referred_by à la table profiles.
-- Le code est généré automatiquement à l'inscription via un trigger.
-- Le parrain reçoit +5 crédits quand son filleul s'inscrit avec son code (côté applicatif).

-- 1. Ajouter les colonnes de parrainage
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id);

-- 2. Ajouter "subscription" à l'enum credit_kind si absent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'subscription'
      AND enumtypid = 'public.credit_kind'::regtype
  ) THEN
    ALTER TYPE public.credit_kind ADD VALUE 'subscription';
  END IF;
END $$;

-- 3. Fonction de génération d'un code de parrainage 8 caractères
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code  TEXT := '';
  i     INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN code;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_referral_code() FROM PUBLIC, anon, authenticated;

-- 4. Trigger : assure que chaque profil a un referral_code unique à l'INSERT
CREATE OR REPLACE FUNCTION public.ensure_referral_code()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  candidate TEXT;
  max_tries  INT := 20;
  i          INT := 0;
BEGIN
  IF NEW.referral_code IS NOT NULL THEN
    RETURN NEW;
  END IF;
  LOOP
    i := i + 1;
    IF i > max_tries THEN
      -- Fallback : gen_random_uuid() garanti unique
      NEW.referral_code := replace(gen_random_uuid()::text, '-', '');
      EXIT;
    END IF;
    candidate := public.generate_referral_code();
    BEGIN
      NEW.referral_code := candidate;
      EXIT; -- sortie anticipée si pas de conflit (la contrainte UNIQUE vérifiera)
    EXCEPTION WHEN unique_violation THEN
      -- retry
    END;
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_referral_code() FROM PUBLIC, anon, authenticated;

-- Créer le trigger uniquement s'il n'existe pas déjà
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_ensure_referral_code'
      AND tgrelid = 'public.profiles'::regclass
  ) THEN
    CREATE TRIGGER trg_ensure_referral_code
      BEFORE INSERT ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.ensure_referral_code();
  END IF;
END $$;

-- 5. Rétroactivement peupler referral_code pour les profils existants
DO $$
DECLARE
  r         RECORD;
  candidate TEXT;
  chars     TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code      TEXT;
  i         INT;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE referral_code IS NULL LOOP
    FOR attempt IN 1..20 LOOP
      code := '';
      FOR i IN 1..8 LOOP
        code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
      END LOOP;
      BEGIN
        UPDATE public.profiles SET referral_code = code WHERE id = r.id;
        EXIT; -- succès
      EXCEPTION WHEN unique_violation THEN
        -- retry
      END;
    END LOOP;
  END LOOP;
END $$;

-- 6. Index pour accélérer la recherche par code
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by);
