/**
 * Suivi analytics léger côté client, avec journal first-party best-effort côté serveur.
 *
 * Objectifs mesurés :
 *  - `cta_view`      : une carte/bouton CTA « Analyser un match » est apparu à l'écran
 *  - `cta_click`     : clic sur un CTA vers /analyse
 *  - `analyse_view`  : arrivée sur la page /analyse (conversion)
 *  - `analyse_run`   : analyse réellement lancée (conversion profonde)
 *  - `promo_*`       : interactions codes promo (copie de code, clic affilié)
 *
 * Les événements sont envoyés à `window.dataLayer` / `gtag` s'ils existent
 * (Google Analytics, GTM, Plausible…), et agrégés en local pour pouvoir lire
 * un taux de conversion sans backend via `getFunnel()`.
 */

import { useEffect, useRef } from "react";
import { trackMetaPixel } from "@/lib/meta-pixel";

export type AnalyticsEvent =
  | "landing_view"
  | "cta_view"
  | "cta_click"
  | "analyse_view"
  | "analyse_run"
  | "signup_started"
  | "signup_completed"
  | "analysis_result_view"
  | "premium_view"
  | "premium_cta_click"
  | "premium_checkout_started"
  | "premium_checkout_redirected"
  | "promo_code_copy"
  | "promo_affiliate_click";

export type FixtureDiagnostic = {
  reason: "today_unavailable" | "live_unavailable" | "render_failure";
  errorCode: string;
  stylesLoaded: boolean;
  matchesCount: number;
  cacheId: string | null;
  page: string;
};

type Props = Record<string, string | number | boolean | undefined>;

const STORE_KEY = "lf_analytics_v1";
const LAST_CTA_KEY = "lf_last_cta";
const CONVERSION_SESSION_KEY = "lf_conversion_session";

type Store = Record<string, number>;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

function bump(key: string) {
  if (typeof window === "undefined") return;
  try {
    const s = readStore();
    s[key] = (s[key] ?? 0) + 1;
    window.localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* quota / mode privé : on ignore */
  }
}

function conversionSessionId() {
  if (typeof window === "undefined") return undefined;
  try {
    const existing = window.sessionStorage.getItem(CONVERSION_SESSION_KEY);
    if (existing && /^[a-zA-Z0-9_-]{16,80}$/.test(existing)) return existing;
    const next = crypto.randomUUID().replaceAll("-", "");
    window.sessionStorage.setItem(CONVERSION_SESSION_KEY, next);
    return next;
  } catch {
    return undefined;
  }
}

function conversionContext() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  return {
    route: window.location.pathname,
    source: params.get("utm_source")?.slice(0, 80),
    medium: params.get("utm_medium")?.slice(0, 80),
    campaign: params.get("utm_campaign")?.slice(0, 120),
  };
}

function sendFirstPartyEvent(event: AnalyticsEvent, props: Props) {
  const sessionId = conversionSessionId();
  if (!sessionId || typeof window === "undefined") return;
  const context = conversionContext();
  const metadata = Object.fromEntries(
    Object.entries(props).filter(([, value]) =>
      typeof value === "string" || typeof value === "number" || typeof value === "boolean",
    ),
  );
  const body = JSON.stringify({ event, sessionId, ...context, metadata });
  try {
    void fetch("/api/public/conversion-event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Le suivi ne doit jamais ralentir ou bloquer le parcours utilisateur.
  }
}

/** Envoie un événement analytics. Sûr en SSR (no-op côté serveur). */
export function track(event: AnalyticsEvent, props: Props = {}) {
  if (typeof window === "undefined") return;

  const payload = { event, ...props, ts: Date.now() };
  sendFirstPartyEvent(event, props);

  const w = window as unknown as {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    plausible?: (name: string, opts?: { props: Props }) => void;
  };

  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push(payload);
  w.gtag?.("event", event, props);
  w.plausible?.(event, { props });

  const metaEvent =
    event === "analyse_run"
      ? "Lead"
      : event === "analyse_view"
        ? "ViewContent"
        : event === "promo_affiliate_click"
          ? "OutboundClick"
          : "LiveFootInteraction";
  trackMetaPixel(metaEvent, {
    content_name: event,
    ...(typeof props.location === "string" ? { content_category: props.location } : {}),
  });

  bump(event);
  if (props.location) bump(`${event}:${props.location}`);

  if (event === "cta_click" && props.location) {
    try {
      window.sessionStorage.setItem(LAST_CTA_KEY, String(props.location));
    } catch {
      /* ignore */
    }
  }
}

/** Envoie un signal technique minimal sans identifiant, email ni contenu utilisateur. */
export function reportFixtureDiagnostic(diagnostic: FixtureDiagnostic) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({
    ...diagnostic,
    device: window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop",
    viewport: `${window.innerWidth}x${window.innerHeight}`.slice(0, 24),
    userAgent: navigator.userAgent.slice(0, 120),
    at: new Date().toISOString(),
  });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/public/fixture-diagnostic",
        new Blob([payload], { type: "application/json" }),
      );
      return;
    }
    void fetch("/api/public/fixture-diagnostic", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Le diagnostic ne doit jamais perturber l'affichage des matchs.
  }
}

/** Dernière source CTA ayant mené vers /analyse (pour attribuer la conversion). */
export function lastCtaSource(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.sessionStorage.getItem(LAST_CTA_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Compteurs agrégés + taux de conversion CTA → /analyse. */
export function getFunnel() {
  const s = readStore();
  const views = s["cta_view"] ?? 0;
  const clicks = s["cta_click"] ?? 0;
  const analyseViews = s["analyse_view"] ?? 0;
  const runs = s["analyse_run"] ?? 0;
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
  return {
    ctaViews: views,
    ctaClicks: clicks,
    analyseViews,
    analyseRuns: runs,
    clickThroughRate: pct(clicks, views),
    conversionRate: pct(analyseViews, clicks),
    completionRate: pct(runs, analyseViews),
    raw: s,
  };
}

/**
 * Marque un élément CTA : une impression est comptée la première fois
 * qu'au moins la moitié du bloc entre dans le viewport.
 */
export function useCtaImpression<T extends HTMLElement>(location: string) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let seen = false;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !seen) {
            seen = true;
            track("cta_view", { location });
            obs.disconnect();
          }
        }
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [location]);
  return ref;
}
