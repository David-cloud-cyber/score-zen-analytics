-- Chariow provider reconciliation for the active checkout flow.
-- Historical provider columns remain for audit compatibility, but new payment
-- reservations and settlements are created only with provider = 'chariow'.
alter table public.payments
  add column if not exists provider_sale_id text;

alter table public.subscriptions
  add column if not exists provider_sale_id text;

create unique index if not exists payments_provider_sale_id_unique
  on public.payments (provider, provider_sale_id)
  where provider_sale_id is not null;

create unique index if not exists subscriptions_provider_sale_id_unique
  on public.subscriptions (provider, provider_sale_id)
  where provider_sale_id is not null;

create index if not exists payments_provider_status_idx
  on public.payments (provider, status);

create index if not exists subscriptions_provider_status_idx
  on public.subscriptions (provider, status);
