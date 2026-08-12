import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { COOKIE_CONSENT_EVENT, COOKIE_CONSENT_KEY } from "@/lib/meta-pixel";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && !window.localStorage.getItem(COOKIE_CONSENT_KEY)) {
        setVisible(true);
      }
    } catch { /* ignore */ }
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
    <div className="cookie-banner fixed bottom-24 left-1/2 z-50 w-[min(440px,calc(100%-1rem))] -translate-x-1/2 rounded-[1.35rem] bg-[#080b10] p-4 text-[#f8fafc] shadow-[0_18px_45px_rgba(0,0,0,0.38)] ring-1 ring-white/10 lg:bottom-6">
      <div className="flex items-start gap-3">
        <div className="flex-1 text-[12px] leading-snug">
          <div className="mb-1 font-bold">Cookies & confidentialité</div>
          <p className="text-[#c7ced8]">
            Les cookies essentiels font fonctionner le service. Avec votre accord, nous activons
            aussi une mesure d’audience publicitaire.{" "}
            <Link to="/mentions-legales" className="underline">
              En savoir plus
            </Link>
          </p>
        </div>
        <button
          onClick={() => decide("declined")}
          aria-label="Fermer"
          className="grid size-6 place-items-center rounded-full text-[#aab3c0] transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => decide("declined")}
          className="flex-1 rounded-xl border border-white/15 py-2 text-[11px] font-bold text-[#f8fafc]/80 transition-colors hover:bg-white/5"
        >
          Refuser
        </button>
        <button
          onClick={() => decide("accepted")}
          className="flex-1 rounded-xl bg-brand py-2 text-[11px] font-black text-brand-foreground hover:bg-brand/90"
        >
          Accepter
        </button>
      </div>
    </div>
  );
}
