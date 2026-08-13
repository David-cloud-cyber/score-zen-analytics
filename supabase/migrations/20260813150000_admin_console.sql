-- Secure administrative console: additive schema only.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_account_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_status_check CHECK (account_status IN ('active', 'suspended'));

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  reason TEXT,
  before_state JSONB,
  after_state JSONB,
  request_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_action_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  result JSONB
);

ALTER TABLE public.admin_action_requests
  DROP CONSTRAINT IF EXISTS admin_action_requests_status_check;
ALTER TABLE public.admin_action_requests
  ADD CONSTRAINT admin_action_requests_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'executed'));

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON public.admin_audit_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON public.admin_audit_log(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_requests_status ON public.admin_action_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_admin_status ON public.profiles(account_status, plan, created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_action_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_audit_log FROM anon, authenticated;
REVOKE ALL ON public.admin_action_requests FROM anon, authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
GRANT ALL ON public.admin_action_requests TO service_role;

-- Keep the audit trail append-only even for service role through application policy.
CREATE OR REPLACE FUNCTION public.prevent_admin_audit_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'ADMIN_AUDIT_IMMUTABLE';
END;
$$;

DROP TRIGGER IF EXISTS admin_audit_no_update ON public.admin_audit_log;
CREATE TRIGGER admin_audit_no_update
BEFORE UPDATE OR DELETE ON public.admin_audit_log
FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_audit_mutation();

REVOKE ALL ON FUNCTION public.prevent_admin_audit_mutation() FROM PUBLIC, anon, authenticated;

