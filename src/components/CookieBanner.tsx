import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";

const KEY = "lf-cookies-consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && !window.localStorage.getItem(KEY)) {
        setVisible(true);
      }
    } catch { /* ignore */ }
  }, []);

  function decide(value: "accepted" | "declined") {
    try { window.localStorage.setItem(KEY, value); } catch { /* ignore */ }
    setVisible(false);
  }

  if (!visible) return null;
  return (
    <div className="fixed bottom-24 left-1/2 z-50 w-[min(440px,calc(100%-1rem))] -translate-x-1/2 rounded-2xl bg-foreground p-4 text-background shadow-2xl ring-1 ring-background/10 lg:bottom-6">
      <div className="flex items-start gap-3">
        <div className="flex-1 text-[12px] leading-snug">
          <div className="mb-1 font-bold">Cookies & confidentialité</div>
          <p className="text-background/70">
            Nous utilisons uniquement des cookies essentiels au fonctionnement du service (session,
            préférences). Aucun tracking publicitaire.{" "}
            <Link to="/mentions-legales" className="underline">
              En savoir plus
            </Link>
          </p>
        </div>
        <button
          onClick={() => decide("declined")}
          aria-label="Fermer"
          className="grid size-6 place-items-center rounded-full text-background/60 hover:text-background"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => decide("declined")}
          className="flex-1 rounded-xl border border-background/15 py-2 text-[11px] font-bold text-background/80 hover:bg-background/5"
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
