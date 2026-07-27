-- Migration: Subscriptions table & Premium support

-- 1. Add premium_until column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;

-- 2. Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  provider TEXT NOT NULL DEFAULT 'fapshi',
  trans_id TEXT UNIQUE,
  external_id TEXT NOT NULL UNIQUE,
  amount_xaf INTEGER NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grants & RLS for subscriptions
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_external_id_idx ON public.subscriptions(external_id);

-- Trigger for updated_at
CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Update handle_new_user trigger to give 5 welcome credits instead of 10
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  init_name text;
BEGIN
  init_name := coalesce(
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'display_name',
    split_part(new.email, '@', 1)
  );

  INSERT INTO public.profiles (id, credits, plan, display_name)
  VALUES (new.id, 5, 'free', init_name)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.credits_ledger (user_id, kind, amount, balance_after, label)
  VALUES (new.id, 'bonus', 5, 5, 'Offert à l''inscription')
  ON CONFLICT DO NOTHING;

  RETURN new;
END;
$$;
