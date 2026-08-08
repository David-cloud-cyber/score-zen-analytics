/**
 * Contrôle explicite du popup de parrainage.
 *
 * Le popup ne s'ouvre jamais tout seul : l'utilisateur le déclenche depuis
 * son espace Profil. Cela évite d'interrompre une analyse ou une navigation.
 */
import { useEffect, useState, useCallback } from "react";

export const REFERRAL_OPEN_EVENT = "livefoot:open-referral";

export type PopupVariant = "free_invite" | "premium_low_credits" | null;

/** Ouvre le popup depuis un bouton ou une action explicite de l'interface. */
export function requestReferralPopup() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(REFERRAL_OPEN_EVENT));
  }
}

export function useReferralPopup() {
  const [variant, setVariant] = useState<PopupVariant>(null);

  const dismiss = useCallback(() => setVariant(null), []);

  useEffect(() => {
    const open = () => setVariant("free_invite");
    window.addEventListener(REFERRAL_OPEN_EVENT, open);
    return () => window.removeEventListener(REFERRAL_OPEN_EVENT, open);
  }, []);

  return { variant, dismiss };
}
