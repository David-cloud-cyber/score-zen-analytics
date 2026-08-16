-- Direct Mobile Money checkout metadata.
-- Phone numbers are intentionally not stored; the provider receives them only
-- for the direct request and the transaction remains linked by external_id.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS checkout_mode TEXT NOT NULL DEFAULT 'hosted',
  ADD COLUMN IF NOT EXISTS medium TEXT;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS checkout_mode TEXT NOT NULL DEFAULT 'hosted',
  ADD COLUMN IF NOT EXISTS medium TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_checkout_mode_check'
      AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_checkout_mode_check
      CHECK (checkout_mode IN ('direct', 'hosted'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscriptions_checkout_mode_check'
      AND conrelid = 'public.subscriptions'::regclass
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_checkout_mode_check
      CHECK (checkout_mode IN ('direct', 'hosted'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_medium_check'
      AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_medium_check
      CHECK (medium IS NULL OR medium IN ('mobile money', 'orange money'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscriptions_medium_check'
      AND conrelid = 'public.subscriptions'::regclass
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_medium_check
      CHECK (medium IS NULL OR medium IN ('mobile money', 'orange money'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS payments_status_created_idx
  ON public.payments (status, created_at DESC);

CREATE INDEX IF NOT EXISTS subscriptions_status_created_idx
  ON public.subscriptions (status, created_at DESC);
