-- Fast, recoverable checkout initialization for Fapshi payments.
-- The provider transaction is intentionally nullable while Fapshi is being called.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS checkout_request_id UUID,
  ADD COLUMN IF NOT EXISTS checkout_link TEXT;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS checkout_request_id UUID,
  ADD COLUMN IF NOT EXISTS checkout_link TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_checkout_request_id_uidx
  ON public.subscriptions (checkout_request_id)
  WHERE checkout_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payments_checkout_request_id_uidx
  ON public.payments (checkout_request_id)
  WHERE checkout_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS subscriptions_external_id_idx
  ON public.subscriptions (external_id);

CREATE INDEX IF NOT EXISTS payments_external_id_idx
  ON public.payments (external_id);

CREATE INDEX IF NOT EXISTS subscriptions_trans_id_idx
  ON public.subscriptions (trans_id)
  WHERE trans_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_trans_id_idx
  ON public.payments (trans_id)
  WHERE trans_id IS NOT NULL;
