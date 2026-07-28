import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Route de retour après OAuth (Google, etc.)
 * Supabase redirige ici avec un `code` dans l'URL.
 * Le SDK échange automatiquement ce code contre une session,
 * puis on renvoie l'utilisateur vers l'accueil.
 */
export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase JS v2 détecte automatiquement le ?code= dans l'URL et crée la session
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        navigate({ to: "/" });
      }
    });

    // Fallback : si la session est déjà là (rechargement), on redirige
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });

    return () => sub.subscription.unsubscribe();
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
