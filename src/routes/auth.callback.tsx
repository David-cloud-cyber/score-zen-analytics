import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buildRouteMeta } from "@/lib/seo";
import { useServerFn } from "@tanstack/react-start";
import { applyReferral, qualifyMyReferral } from "@/lib/referral.functions";
import { track } from "@/lib/analytics";

const PENDING_REF_KEY = "lfai_pending_ref";

/**
 * Route de retour après OAuth (Google, etc.)
 * Supabase redirige ici avec un `code` dans l'URL.
 * Le SDK échange automatiquement ce code contre une session,
 * puis on applique le code de parrainage éventuel et on redirige.
 */
export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  validateSearch: (search) => ({
    redirect:
      typeof search.redirect === "string" && search.redirect.startsWith("/") && !search.redirect.startsWith("//")
        ? search.redirect
        : "/",
    ref: typeof search.ref === "string" && /^[A-Za-z0-9]{6,12}$/.test(search.ref) ? search.ref.toUpperCase() : undefined,
  }),
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
  const { redirect, ref } = useSearch({ from: "/auth/callback" });
  const applyReferralFn = useServerFn(applyReferral);
  const qualifyReferralFn = useServerFn(qualifyMyReferral);
  const redirectedRef = useRef(false);

  useEffect(() => {
    let completed = false;
    let active = true;
    const timeoutId = setTimeout(() => {
      if (!redirectedRef.current) {
        toast.error("La connexion n’a pas pu être finalisée. Réessayez.");
        redirectedRef.current = true;
        // Remplacement complet pour purger le code OAuth de l’URL. Une
        // navigation SPA peut conserver le callback dans la barre d’adresse
        // lorsqu’un échange échoue avant l’initialisation du routeur.
        window.location.replace("/auth?mode=signin&source=auth_callback_error");
      }
    }, 12_000);
    let unsubscribe = () => {};

    function goToDestination(destination: string) {
      if (!active || redirectedRef.current) return;
      redirectedRef.current = true;
      navigate({ to: destination as never });
    }

    async function finishReferral() {
      if (completed) return;
      completed = true;
      try {
        const stored = sessionStorage.getItem(PENDING_REF_KEY);
        const code = ref ?? stored;
        if (code) {
          sessionStorage.removeItem(PENDING_REF_KEY);
          await applyReferralFn({ data: { referralCode: code } });
        }
        const qualification = await qualifyReferralFn();
        if (qualification.qualified) track("referral_invitation_confirmed", { location: "auth_callback" });
        if (qualification.rewardsGranted > 0) {
          track("referral_milestone_reached", { location: "auth_callback", rewards: qualification.rewardsGranted });
          toast.success("🎉 Votre invitation a débloqué Premium Pro pour votre parrain.");
        }
      } catch {
        // La connexion reste prioritaire ; la prochaine connexion peut reprendre la validation.
      }
    }

    async function handleCallback() {
      const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === "SIGNED_IN" && session) {
          await finishReferral();
          goToDestination(redirect);
        }
      });
      unsubscribe = () => sub.subscription.unsubscribe();
      if (!active) {
        unsubscribe();
        return;
      }

      // Fallback : session déjà disponible (rechargement)
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await finishReferral();
          goToDestination(redirect);
        }
      } catch {
        // Le délai de sécurité ci-dessus renvoie vers la connexion sans
        // laisser l'utilisateur bloqué si l'échange OAuth échoue.
      }
    }

    handleCallback();

    return () => {
      active = false;
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [applyReferralFn, navigate, qualifyReferralFn, redirect, ref]);

  return (
    <div className="grid min-h-dvh place-items-center bg-background">
      <div className="flex flex-col items-center gap-4 text-muted-foreground">
        <Loader2 className="size-8 animate-spin text-brand" />
        <p className="text-sm font-medium">Connexion en cours…</p>
      </div>
    </div>
  );
}
