/**
 * Hook qui gère l'affichage du popup de parrainage / upgrade.
 *
 * Règles d'affichage :
 * ─ Free users :
 *     1. Une seule fois par login (localStorage mémorise la date du dernier affichage).
 *     2. OU quand crédits < LOW_CREDITS_THRESHOLD.
 *     Fermé → sessionStorage empêche de re-montrer dans la même session.
 *
 * ─ Premium users :
 *     Quand crédits < LOW_CREDITS_THRESHOLD → popup spécifique "rechargez / annuel".
 *     Fermé → sessionStorage empêche de re-montrer dans la même session.
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const LOW_CREDITS_THRESHOLD = 5;
const SESSION_KEY = "lfai_referral_popup_session"; // présent = déjà montré cette session
const LOGIN_KEY = "lfai_referral_last_login_date"; // date ISO du dernier affichage sur login

export type PopupVariant = "free_invite" | "premium_low_credits" | null;

export function useReferralPopup(credits: number | null, plan: "free" | "premium" | null) {
  const [variant, setVariant] = useState<PopupVariant>(null);

  const dismiss = useCallback(() => {
    setVariant(null);
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // SSR safety
    }
  }, []);

  useEffect(() => {
    if (credits === null || plan === null) return;

    // Déjà montré cette session → on sort
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch {
      return;
    }

    // Afficher avec un léger délai pour ne pas interrompre le chargement
    const timer = setTimeout(() => {
      if (plan === "free") {
        // Condition 1 : premier affichage de la journée (login)
        const today = new Date().toDateString();
        let showOnLogin = false;
        try {
          const last = localStorage.getItem(LOGIN_KEY);
          if (last !== today) {
            showOnLogin = true;
            localStorage.setItem(LOGIN_KEY, today);
          }
        } catch {
          showOnLogin = false;
        }

        // Condition 2 : crédits faibles
        const lowCredits = credits < LOW_CREDITS_THRESHOLD && credits >= 0;

        if (showOnLogin || lowCredits) {
          setVariant("free_invite");
        }
      } else if (plan === "premium") {
        if (credits < LOW_CREDITS_THRESHOLD && credits >= 0) {
          setVariant("premium_low_credits");
        }
      }
    }, 3000); // 3 s après le chargement

    return () => clearTimeout(timer);
  }, [credits, plan]);

  // Écouter SIGNED_IN pour réinitialiser la mémoire de session
  // (nouvelle connexion = nouvelle session logique)
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        try {
          sessionStorage.removeItem(SESSION_KEY);
        } catch {
          // ignore
        }
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { variant, dismiss };
}
