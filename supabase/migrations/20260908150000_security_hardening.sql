-- Défense en profondeur : les écritures sensibles passent uniquement par les
-- fonctions serveur qui vérifient la session, les droits et les données.

-- Un utilisateur ne doit jamais pouvoir modifier lui-même son plan, ses
-- crédits, son statut, sa date Premium ou son code de parrainage via PostgREST.
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM PUBLIC, anon, authenticated;

-- Les messages et votes sont écrits par community.functions.ts avec la clé
-- service_role après validation. La lecture publique reste inchangée.
REVOKE INSERT, UPDATE, DELETE ON public.community_messages FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.community_predictions FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "Authenticated users can post community_messages" ON public.community_messages;
DROP POLICY IF EXISTS "Authenticated users can place community_predictions" ON public.community_predictions;
DROP POLICY IF EXISTS "Authenticated users can update their community_predictions" ON public.community_predictions;

-- app_config ne doit jamais être consultable depuis le navigateur : il peut
-- contenir des paramètres sensibles utilisés en secours côté serveur.
DROP POLICY IF EXISTS "anon_read" ON public.app_config;
DROP POLICY IF EXISTS "Anyone can read app config" ON public.app_config;
REVOKE ALL ON public.app_config FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.app_config TO service_role;
