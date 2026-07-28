-- 1. Credit kind enum: add subscription
ALTER TYPE public.credit_kind ADD VALUE IF NOT EXISTS 'subscription';

-- 2. app_config: remove public/anon/authenticated read access
DROP POLICY IF EXISTS "anon_read" ON public.app_config;
DROP POLICY IF EXISTS "Anyone can read app config" ON public.app_config;
REVOKE ALL ON public.app_config FROM anon, authenticated;
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- 3. profiles: explicit self-delete policy
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
CREATE POLICY "Users can delete their own profile"
ON public.profiles FOR DELETE TO authenticated
USING (auth.uid() = id);

-- 4. SECURITY DEFINER / trigger functions: revoke public execute
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;