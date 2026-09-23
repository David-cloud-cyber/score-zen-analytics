-- SasPay is the active hosted checkout provider.
-- Historical Fapshi/Chariow rows remain readable and reconcilable; no existing
-- transaction is rewritten by this migration.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS checkout_request_id UUID,
  ADD COLUMN IF NOT EXISTS checkout_link TEXT,
  ADD COLUMN IF NOT EXISTS checkout_mode TEXT NOT NULL DEFAULT 'hosted',
  ADD COLUMN IF NOT EXISTS provider_sale_id TEXT,
  ADD COLUMN IF NOT EXISTS customer_email TEXT;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS checkout_request_id UUID,
  ADD COLUMN IF NOT EXISTS checkout_link TEXT,
  ADD COLUMN IF NOT EXISTS checkout_mode TEXT NOT NULL DEFAULT 'hosted',
  ADD COLUMN IF NOT EXISTS provider_sale_id TEXT,
  ADD COLUMN IF NOT EXISTS customer_email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS payments_saspay_provider_id_unique
  ON public.payments (provider, provider_sale_id)
  WHERE provider = 'saspay' AND provider_sale_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_saspay_provider_id_unique
  ON public.subscriptions (provider, provider_sale_id)
  WHERE provider = 'saspay' AND provider_sale_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_saspay_pending_idx
  ON public.payments (provider, status, created_at DESC)
  WHERE provider = 'saspay' AND status = 'PENDING';

CREATE INDEX IF NOT EXISTS subscriptions_saspay_pending_idx
  ON public.subscriptions (provider, status, created_at DESC)
  WHERE provider = 'saspay' AND status = 'PENDING';

COMMENT ON COLUMN public.payments.provider IS 'Payment provider: saspay for new checkouts; historical values remain supported for reconciliation.';
COMMENT ON COLUMN public.subscriptions.provider IS 'Payment provider: saspay for new checkouts; historical values remain supported for reconciliation.';
