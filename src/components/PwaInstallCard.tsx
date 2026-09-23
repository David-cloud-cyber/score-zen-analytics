import { Check, Download, Gift, Smartphone } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-session";
import { claimPwaInstallBonus } from "@/lib/pwa.functions";
import { track } from "@/lib/analytics";
import { isLocalDemo } from "@/lib/local-demo";
import { cn } from "@/lib/utils";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallState = "loading" | "available" | "instructions" | "waiting" | "installed";

function deviceFamily(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  return window.innerWidth < 640 ? "mobile" : window.innerWidth < 1024 ? "tablet" : "desktop";
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  const iosStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

export function PwaInstallCard({ className, location }: { className?: string; location: string }) {
  const { user } = useSession();
  const claim = useServerFn(claimPwaInstallBonus);
  const deferredPrompt = useRef<InstallPromptEvent | null>(null);
  const claimStarted = useRef(false);
  const [state, setState] = useState<InstallState>("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isLocalDemo()) {
      setState("instructions");
      return;
    }

    track("pwa_install_prompt_viewed", { location, audience: user ? "member" : "guest" });
    const installed = isStandalone();
    setState(installed ? "installed" : "instructions");

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPrompt.current = event as InstallPromptEvent;
      if (!isStandalone()) setState("available");
    };
    const onAppInstalled = () => {
      deferredPrompt.current = null;
      setState("installed");
      track("pwa_installed", { location, device: deviceFamily() });
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [location, user]);

  useEffect(() => {
    if (!user || state !== "installed" || claimStarted.current || isLocalDemo()) return;
    claimStarted.current = true;
    void claim({ data: { signal: "standalone", deviceFamily: deviceFamily() } })
      .then((result) => {
        if (result.granted) {
          track("pwa_install_bonus_granted", { location, credits: result.creditsAwarded });
          setMessage("Installation détectée : +5 crédits ajoutés à ton compte.");
        } else {
          setMessage("Installation détectée : le bonus a déjà été attribué à ce compte.");
        }
      })
      .catch(() => {
        claimStarted.current = false;
        setMessage(
          "Installation détectée. Connecte-toi à nouveau depuis l’application pour récupérer ton bonus.",
        );
      });
  }, [claim, location, state, user]);

  async function install() {
    track("pwa_install_clicked", { location, audience: user ? "member" : "guest" });
    const prompt = deferredPrompt.current;
    if (!prompt) {
      setState("instructions");
      setMessage("Ouvre le menu de ton navigateur puis choisis « Ajouter à l’écran d’accueil ».");
      return;
    }
    setState("waiting");
    await prompt.prompt();
    const choice = await prompt.userChoice;
    deferredPrompt.current = null;
    if (choice.outcome === "dismissed") setState("instructions");
  }

  return (
    <section
      className={cn(
        "rounded-2xl border border-brand/25 bg-gradient-to-br from-brand/10 via-card to-card p-4 shadow-sm",
        className,
      )}
      aria-labelledby={`pwa-install-title-${location}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-brand-foreground">
            {state === "installed" ? (
              <Check className="size-5" aria-hidden />
            ) : (
              <Smartphone className="size-5" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.15em] text-brand">
              <Gift className="size-3" aria-hidden /> Bonus installation
            </p>
            <h2
              id={`pwa-install-title-${location}`}
              className="mt-1 text-sm font-black leading-tight"
            >
              Installe LiveFoot et gagne 5 crédits
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Accède plus vite aux matchs et garde LiveFoot sur ton téléphone.
              {!user ? " Connecte-toi ensuite pour recevoir le bonus sur ton compte." : null}
            </p>
            {message ? (
              <p className="mt-1.5 text-[11px] font-bold text-brand" aria-live="polite">
                {message}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          {state !== "installed" ? (
            <button
              type="button"
              onClick={() => void install()}
              disabled={state === "loading" || state === "waiting"}
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2 text-xs font-black text-brand-foreground transition hover:bg-brand/90 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
            >
              <Download className="size-4" aria-hidden />
              {state === "waiting" ? "Installation en cours…" : "Installer l’application"}
            </button>
          ) : (
            <span className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-brand/15 px-4 py-2 text-xs font-black text-brand">
              <Check className="size-4" aria-hidden /> Application installée
            </span>
          )}
          {!user && state === "installed" ? (
            <Link
              to="/auth"
              search={{
                mode: "signup",
                redirect: "/pronostics-du-jour",
                source: "pwa_install_bonus",
              }}
              className="text-[11px] font-black text-brand hover:underline"
            >
              Créer mon compte pour recevoir les 5 crédits →
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
