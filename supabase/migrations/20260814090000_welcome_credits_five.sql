-- New accounts receive five welcome credits.
-- Existing balances are intentionally unchanged.

ALTER TABLE public.profiles
  ALTER COLUMN credits SET DEFAULT 5;

-- Keep the signup trigger explicit so a future profile always receives the
-- same welcome balance even if the profile insert is changed later.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
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
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)
  );

  INSERT INTO public.profiles (id, credits, plan, display_name, avatar_url)
  VALUES (
    new.id,
    5,
    'free',
    init_name,
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.credits_ledger (user_id, kind, amount, balance_after, label)
  VALUES (new.id, 'bonus', 5, 5, 'Crédits de bienvenue')
  ON CONFLICT DO NOTHING;

  RETURN new;
END;
$$;
