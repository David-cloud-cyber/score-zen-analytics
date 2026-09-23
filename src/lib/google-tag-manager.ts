import { hasAnalyticsConsent } from "@/lib/meta-pixel";

/**
 * Identifiants publics des balises Google de LiveFoot.
 * Ils ne donnent aucun accès au compte Google Analytics ou Tag Manager.
 */
export const GOOGLE_ANALYTICS_MEASUREMENT_ID = "G-0KY3GTQZ0K";
export const GOOGLE_TAG_MANAGER_ID = "GTM-MS8BZ6NQ";

type ConsentValue = "granted" | "denied";

type GoogleTagWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

function sendToGoogleTag(...args: unknown[]) {
  if (typeof window === "undefined") return;
  const target = window as GoogleTagWindow;
  target.dataLayer = target.dataLayer ?? [];

  if (target.gtag) {
    target.gtag(...args);
    return;
  }

  target.dataLayer.push(args);
}

/** Synchronise le choix de cookies LiveFoot avec Google Consent Mode. */
export function syncGoogleConsent(accepted = hasAnalyticsConsent()) {
  const value: ConsentValue = accepted ? "granted" : "denied";
  sendToGoogleTag("consent", "update", {
    analytics_storage: value,
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
  });
}

/**
 * Déclare un changement de page SPA une fois la mesure d'audience acceptée.
 * GTM reste l'unique route de collecte : aucun second script GA4 n'est chargé.
 */
export function trackGooglePageView(path: string) {
  if (typeof window === "undefined" || !hasAnalyticsConsent()) return;

  sendToGoogleTag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
    send_to: GOOGLE_ANALYTICS_MEASUREMENT_ID,
  });
}
