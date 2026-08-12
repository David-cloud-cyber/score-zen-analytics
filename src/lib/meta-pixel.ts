export const META_PIXEL_ID = "1757294315608745";
export const COOKIE_CONSENT_KEY = "lf-cookies-consent";
export const COOKIE_CONSENT_EVENT = "livefoot-cookie-consent";

type MetaFbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  initialized?: boolean;
  loaded?: boolean;
  push?: MetaFbq;
  queue?: unknown[];
  version?: string;
};

type MetaWindow = Window & { fbq?: MetaFbq; _fbq?: MetaFbq };

export function hasAnalyticsConsent() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COOKIE_CONSENT_KEY) === "accepted";
  } catch {
    return false;
  }
}

export function loadMetaPixel() {
  if (typeof window === "undefined" || !hasAnalyticsConsent()) return false;

  const win = window as MetaWindow;
  if (win.fbq?.initialized) return true;

  const fbq: MetaFbq = (...args: unknown[]) => {
    if (fbq.callMethod) {
      fbq.callMethod(...args);
      return;
    }
    fbq.queue = fbq.queue ?? [];
    fbq.queue.push(args);
  };
  fbq.push = fbq;
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.initialized = true;
  win.fbq = win.fbq ?? fbq;
  win._fbq = win._fbq ?? win.fbq;

  if (!document.querySelector('script[data-livefoot-meta-pixel="true"]')) {
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    script.dataset.livefootMetaPixel = "true";
    document.head.appendChild(script);
  }

  win.fbq?.("init", META_PIXEL_ID);
  return true;
}

export function trackMetaPixel(
  event: string,
  params: Record<string, string | number> = {},
) {
  if (!loadMetaPixel()) return;
  const standardEvents = new Set([
    "PageView",
    "ViewContent",
    "Lead",
    "CompleteRegistration",
    "Purchase",
  ]);
  (window as MetaWindow).fbq?.(
    standardEvents.has(event) ? "track" : "trackCustom",
    event,
    params,
  );
}
