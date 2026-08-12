import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import {
  COOKIE_CONSENT_EVENT,
  COOKIE_CONSENT_KEY,
  COOKIE_PREFERENCES_EVENT,
} from "@/lib/meta-pixel";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const reopen = () => setVisible(true);

    try {
      if (typeof window !== "undefined" && !window.localStorage.getItem(COOKIE_CONSENT_KEY)) {
        setVisible(true);
      }
    } catch {
      /* Le service reste utilisable si le stockage est indisponible. */
    }

    window.addEventListener(COOKIE_PREFERENCES_EVENT, reopen);
    return () => window.removeEventListener(COOKIE_PREFERENCES_EVENT, reopen);
  }, []);

  function decide(value: "accepted" | "declined") {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
      window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: value }));
    } catch {
      /* Le service reste utilisable si le stockage est indisponible. */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-description"
      aria-modal="false"
      className="cookie-banner fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-50 w-[min(460px,calc(100%-1rem))] -translate-x-1/2 rounded-[1.35rem] bg-[#080b10] p-4 text-[#f8fafc] shadow-[0_18px_45px_rgba(0,0,0,0.38)] ring-1 ring-white/10 lg:bottom-6"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 text-[12px] leading-snug">
          <div id="cookie-banner-title" className="mb-1 font-bold">
            Cookies & confidentialité
          </div>
          <p id="cookie-banner-description" className="text-[#c7ced8]">
            Les cookies essentiels font fonctionner LiveFoot. Avec votre accord, nous activons
            aussi la mesure d’audience et les fonctionnalités publicitaires Meta. Votre choix est
            modifiable à tout moment. {" "}
            <Link to="/mentions-legales" className="underline underline-offset-2">
              En savoir plus
            </Link>
          </p>
        </div>
        <button
          type="button"
          onClick={() => decide("declined")}
          aria-label="Refuser et fermer"
          className="grid size-6 shrink-0 place-items-center rounded-full text-[#aab3c0] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => decide("declined")}
          className="flex-1 rounded-xl border border-white/20 py-2.5 text-[11px] font-bold text-[#f8fafc]/85 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          Refuser
        </button>
        <button
          type="button"
          onClick={() => decide("accepted")}
          className="flex-1 rounded-xl bg-brand py-2.5 text-[11px] font-black text-brand-foreground transition-colors hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          Accepter
        </button>
      </div>
    </div>
  );
}
