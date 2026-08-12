import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  COOKIE_CONSENT_EVENT,
  hasAnalyticsConsent,
  trackMetaPixel,
} from "@/lib/meta-pixel";

export function MetaPixel() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    const sendPageView = () => {
      if (hasAnalyticsConsent()) trackMetaPixel("PageView");
    };

    sendPageView();
    window.addEventListener(COOKIE_CONSENT_EVENT, sendPageView);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, sendPageView);
  }, [pathname]);

  return null;
}
