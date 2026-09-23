-- Récompense d'installation PWA : une seule attribution par compte,
-- indépendante du nombre d'appareils ou de réinstallations.

CREATE OR REPLACE FUNCTION public.grant_pwa_install_bonus(p_user_id UUID)
RETURNS TABLE (granted BOOLEAN, credits_awarded INTEGER, new_balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_id UUID;
  balance INTEGER;
BEGIN
  INSERT INTO public.credit_grant_events (user_id, grant_key, amount, source)
  VALUES (p_user_id, 'pwa-install-credits-v1', 5, 'pwa_install')
  ON CONFLICT (user_id, grant_key) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN
    SELECT credits INTO balance FROM public.profiles WHERE id = p_user_id;
    RETURN QUERY SELECT false, 0, COALESCE(balance, 0);
    RETURN;
  END IF;

  UPDATE public.profiles
  SET credits = credits + 5,
      updated_at = now()
  WHERE id = p_user_id
  RETURNING credits INTO balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  INSERT INTO public.credits_ledger (user_id, kind, amount, balance_after, label, meta)
  VALUES (
    p_user_id,
    'bonus',
    5,
    balance,
    'Bonus installation de l’application',
    jsonb_build_object('grant_key', 'pwa-install-credits-v1', 'source', 'pwa_install')
  );

  RETURN QUERY SELECT true, 5, balance;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_pwa_install_bonus(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_pwa_install_bonus(UUID) TO service_role;
