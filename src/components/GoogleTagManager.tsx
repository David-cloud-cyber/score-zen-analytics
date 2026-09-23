import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { COOKIE_CONSENT_EVENT, hasAnalyticsConsent } from "@/lib/meta-pixel";
import { syncGoogleConsent, trackGooglePageView } from "@/lib/google-tag-manager";

/** Maintient consentement et pages virtuelles synchronisés dans une application SPA. */
export function GoogleTagManager() {
  const location = useRouterState({ select: (state) => state.location });
  const page = `${location.pathname}${location.searchStr}`;

  useEffect(() => {
    const syncAndTrack = () => {
      const accepted = hasAnalyticsConsent();
      syncGoogleConsent(accepted);
      if (accepted) trackGooglePageView(page);
    };

    syncAndTrack();
    window.addEventListener(COOKIE_CONSENT_EVENT, syncAndTrack);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, syncAndTrack);
  }, [page]);

  return null;
}
