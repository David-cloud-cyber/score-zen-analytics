import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buildRouteMeta } from "@/lib/seo";

const PENDING_REF_KEY = "lfai_pending_ref";

/**
 * Route de retour après OAuth (Google, etc.)
 * Supabase redirige ici avec un `code` dans l'URL.
 * Le SDK échange automatiquement ce code contre une session,
 * puis on applique le code de parrainage éventuel et on redirige.
 */
export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () =>
    buildRouteMeta({
      path: "/auth/callback",
      title: "Connexion en cours",
      description: "Finalisation sécurisée de la connexion LiveFoot.",
      noindex: true,
    }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    async function handleCallback() {
      const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === "SIGNED_IN" && session) {
          // Appliquer le code de parrainage en attente (Google OAuth flow)
          try {
            const code = sessionStorage.getItem(PENDING_REF_KEY);
            if (code) {
              sessionStorage.removeItem(PENDING_REF_KEY);
              // Import dynamique pour éviter le chargement côté serveur
              const { applyReferral } = await import("@/lib/referral.functions");
              // applyReferral est un server function — on l'appelle directement
              // (pas de useServerFn disponible hors composant React)
              const result = await (
                applyReferral as unknown as (args: {
                  data: { referralCode: string };
                }) => Promise<{ ok: boolean }>
              )({ data: { referralCode: code } });
              if (result?.ok) {
                toast.success("🎉 Code de parrainage appliqué ! Votre parrain reçoit +5 crédits.");
              }
            }
          } catch {
            // Silencieux — ne pas bloquer la navigation
          }
          navigate({ to: "/" });
        }
      });

      // Fallback : session déjà disponible (rechargement)
      const { data } = await supabase.auth.getSession();
      if (data.session) navigate({ to: "/" });

      return () => sub.subscription.unsubscribe();
    }

    handleCallback();
  }, [navigate]);

  return (
    <div className="grid min-h-dvh place-items-center bg-background">
      <div className="flex flex-col items-center gap-4 text-muted-foreground">
        <Loader2 className="size-8 animate-spin text-brand" />
        <p className="text-sm font-medium">Connexion en cours…</p>
      </div>
    </div>
  );
}
