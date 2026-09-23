-- Store only the checkout email needed to reconcile direct Chariow links.
-- It is not exposed publicly and is never used as a login credential.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS customer_email TEXT;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS customer_email TEXT;

CREATE INDEX IF NOT EXISTS payments_chariow_pending_customer_idx
  ON public.payments (customer_email, created_at DESC)
  WHERE provider = 'chariow' AND status = 'PENDING';

CREATE INDEX IF NOT EXISTS subscriptions_chariow_pending_customer_idx
  ON public.subscriptions (customer_email, created_at DESC)
  WHERE provider = 'chariow' AND status = 'PENDING';
