-- Programme VIP, notifications, réactions et support.
-- Additif : aucune table existante n'est supprimée et la fiche Match reste inchangée.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS premium_source TEXT,
  ADD COLUMN IF NOT EXISTS vip_tier TEXT;

CREATE TABLE IF NOT EXISTS public.vip_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('starter', 'pro')),
  partner_slug TEXT NOT NULL,
  promo_code TEXT NOT NULL,
  bookmaker_account_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  deposit_amount_xaf INTEGER NOT NULL CHECK (deposit_amount_xaf > 0),
  deposit_date DATE NOT NULL,
  deposit_reference TEXT NOT NULL,
  proof_note TEXT,
  regular_bettor_confirmed BOOLEAN NOT NULL DEFAULT false,
  responsible_gaming_confirmed BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'needs_info', 'approved', 'rejected', 'expired')),
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vip_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL UNIQUE REFERENCES public.vip_applications(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('starter', 'pro')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  monthly_credits INTEGER NOT NULL DEFAULT 100 CHECK (monthly_credits > 0),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS vip_one_approved_grant_per_user
  ON public.vip_grants (user_id);
CREATE INDEX IF NOT EXISTS vip_applications_status_date_idx
  ON public.vip_applications (status, created_at DESC);
CREATE INDEX IF NOT EXISTS vip_applications_user_date_idx
  ON public.vip_applications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.vip_credit_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES public.vip_grants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cycle_key TEXT NOT NULL,
  credits INTEGER NOT NULL CHECK (credits > 0),
  credited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (grant_id, cycle_key)
);

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('community_reply', 'support_reply', 'vip_status', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  entity_id TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_notifications_user_date_idx
  ON public.user_notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_notifications_unread_idx
  ON public.user_notifications (user_id, read_at, created_at DESC);

ALTER TABLE public.community_messages
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.community_messages(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS community_messages_parent_date_idx
  ON public.community_messages (parent_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.community_message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.community_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (emoji IN ('👍', '❤️', '🔥', '😂', '⚽', '👀')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS community_reactions_message_idx
  ON public.community_message_reactions (message_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('payment', 'analysis', 'account', 'premium', 'partner', 'bug', 'other')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'waiting_support', 'waiting_user', 'resolved', 'closed')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_tickets_user_date_idx
  ON public.support_tickets (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_status_date_idx
  ON public.support_tickets (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_role TEXT NOT NULL CHECK (author_role IN ('user', 'admin', 'owner')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS support_messages_ticket_date_idx
  ON public.support_messages (ticket_id, created_at ASC);

ALTER TABLE public.vip_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vip_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vip_credit_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.vip_applications TO authenticated;
GRANT SELECT ON public.vip_grants TO authenticated;
GRANT SELECT ON public.user_notifications TO authenticated;
GRANT UPDATE ON public.user_notifications TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.community_message_reactions TO authenticated;
GRANT SELECT, INSERT ON public.support_tickets TO authenticated;
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON TABLE public.vip_applications, public.vip_grants, public.vip_credit_cycles, public.user_notifications, public.community_message_reactions, public.support_tickets, public.support_messages TO service_role;

CREATE POLICY "Users read own VIP applications" ON public.vip_applications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users submit own VIP applications" ON public.vip_applications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own VIP grants" ON public.vip_grants
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users read own notifications" ON public.user_notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users mark own notifications read" ON public.user_notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own reactions" ON public.community_message_reactions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own support tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own support tickets" ON public.support_tickets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own support messages" ON public.support_messages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
  );
CREATE POLICY "Users create own support messages" ON public.support_messages
  FOR INSERT TO authenticated WITH CHECK (
    author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
  );

-- Toutes les écritures sensibles passent par les fonctions serveur validées.
DROP POLICY IF EXISTS "Users submit own VIP applications" ON public.vip_applications;
DROP POLICY IF EXISTS "Users create own support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users create own support messages" ON public.support_messages;
DROP POLICY IF EXISTS "Users manage own reactions" ON public.community_message_reactions;
REVOKE INSERT, UPDATE, DELETE ON public.vip_applications FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.support_tickets FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.support_messages FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.community_message_reactions FROM authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;

CREATE OR REPLACE FUNCTION public.ensure_vip_monthly_credits(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  grant_row public.vip_grants%ROWTYPE;
  cycle TEXT;
  inserted_id UUID;
  balance INTEGER;
BEGIN
  SELECT * INTO grant_row
  FROM public.vip_grants
  WHERE user_id = p_user_id AND starts_at <= now() AND ends_at > now()
  ORDER BY ends_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN 0; END IF;
  cycle := to_char(date_trunc('month', now()), 'YYYY-MM');
  INSERT INTO public.vip_credit_cycles (grant_id, user_id, cycle_key, credits)
  VALUES (grant_row.id, p_user_id, cycle, grant_row.monthly_credits)
  ON CONFLICT (grant_id, cycle_key) DO NOTHING
  RETURNING id INTO inserted_id;
  IF inserted_id IS NULL THEN RETURN 0; END IF;
  UPDATE public.profiles
  SET credits = credits + grant_row.monthly_credits, plan = 'premium', premium_until = GREATEST(COALESCE(premium_until, grant_row.ends_at), grant_row.ends_at), premium_source = 'vip', vip_tier = grant_row.tier
  WHERE id = p_user_id
  RETURNING credits INTO balance;
  INSERT INTO public.credits_ledger (user_id, kind, amount, balance_after, label, meta)
  VALUES (p_user_id, 'bonus', grant_row.monthly_credits, balance, 'Crédits mensuels VIP', jsonb_build_object('grant_id', grant_row.id, 'cycle', cycle));
  RETURN grant_row.monthly_credits;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_vip_monthly_credits(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_vip_monthly_credits(UUID) TO service_role;
