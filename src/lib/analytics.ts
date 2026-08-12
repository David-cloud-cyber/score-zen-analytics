/**
 * Suivi analytics léger, 100 % front-end (aucune dépendance externe requise).
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
  | "cta_view"
  | "cta_click"
  | "analyse_view"
  | "analyse_run"
  | "promo_code_copy"
  | "promo_affiliate_click";

type Props = Record<string, string | number | boolean | undefined>;

const STORE_KEY = "lf_analytics_v1";
const LAST_CTA_KEY = "lf_last_cta";

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

/** Envoie un événement analytics. Sûr en SSR (no-op côté serveur). */
export function track(event: AnalyticsEvent, props: Props = {}) {
  if (typeof window === "undefined") return;

  const payload = { event, ...props, ts: Date.now() };

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
