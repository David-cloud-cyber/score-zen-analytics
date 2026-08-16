import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  readCookieSnapshot,
  writeCookie,
  clearCookie,
} from "@/integrations/supabase/session-storage";
import { clearLocalDemo, DEMO_SESSION, isLocalDemo } from "@/lib/local-demo";
import { recordUserPresence } from "@/lib/presence.functions";
import { useServerFn } from "@tanstack/react-start";

type SessionCtx = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<SessionCtx>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const recordPresence = useServerFn(recordUserPresence);

  useEffect(() => {
    if (!session || isLocalDemo()) return;

    let disposed = false;
    const deviceFamily = window.matchMedia("(max-width: 639px)").matches
      ? "mobile"
      : window.matchMedia("(max-width: 1023px)").matches
        ? "tablet"
        : "desktop";

    const sendPresence = () => {
      if (disposed || document.hidden) return;
      void recordPresence({
        data: { route: window.location.pathname, deviceFamily },
      }).catch(() => {
        // Presence is best effort and must never interrupt navigation or auth.
      });
    };

    sendPresence();
    const timer = window.setInterval(sendPresence, 30_000);
    const onVisibilityChange = () => {
      if (!document.hidden) sendPresence();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [recordPresence, session]);

  useEffect(() => {
    let mounted = true;

    // Aperçu local : aucune lecture/écriture Supabase et aucune authentification
    // réelle ne sont utilisées quand le mode démo est activé en développement.
    if (isLocalDemo()) {
      setSession(DEMO_SESSION);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    // ── Initialisation de la session ─────────────────────────────────────────
    // 1. getSession() lit depuis hybridStorage (localStorage + cookie backup).
    //    Supabase v2 auto-refresh le token si expiré ET qu'un refresh_token existe.
    // 2. Si getSession() renvoie null, tente une récupération via le cookie seul
    //    (cas : localStorage vidé mais cookie encore valide).
    async function initSession() {
      const { data } = await supabase.auth.getSession();

      if (!mounted) return;

      if (data.session) {
        setSession(data.session);
        setLoading(false);
        return;
      }

      // Tentative de récupération depuis le cookie (localStorage vide/nettoyé)
      const snap = readCookieSnapshot();
      if (snap?.rt) {
        try {
          const { data: recovered } = await supabase.auth.setSession({
            access_token: snap.at,
            refresh_token: snap.rt,
          });
          if (mounted && recovered.session) {
            setSession(recovered.session);
            setLoading(false);
            return;
          }
        } catch {
          // Cookie expiré ou invalide → pas de session
          clearCookie();
        }
      }

      if (mounted) setLoading(false);
    }

    initSession();

    // ── Listener d'état d'auth ───────────────────────────────────────────────
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      setSession(s);
      setLoading(false);

      // Synchroniser le cookie à chaque événement d'auth
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && s) {
        writeCookie({
          at: s.access_token,
          rt: s.refresh_token,
          exp: s.expires_at ?? 0,
        });
      }
      if (event === "SIGNED_OUT") {
        clearCookie();
      }
    });

    // ── Refresh auto au retour sur l'onglet ──────────────────────────────────
    // Quand l'utilisateur revient sur la page après une longue absence,
    // le token JWT peut être expiré (durée de vie : 1h). On force un refresh
    // dès que l'onglet redevient visible afin d'éviter les erreurs 401.
    async function handleVisibilityChange() {
      if (document.hidden || !mounted) return;
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session) {
        setSession(data.session);
      } else {
        // Tentative de récupération cookie si la session localStorage a disparu
        const snap = readCookieSnapshot();
        if (snap?.rt) {
          try {
            const { data: recovered } = await supabase.auth.setSession({
              access_token: snap.at,
              refresh_token: snap.rt,
            });
            if (mounted && recovered.session) setSession(recovered.session);
          } catch {
            clearCookie();
            setSession(null);
          }
        } else {
          setSession(null);
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const signOut = async () => {
    if (isLocalDemo()) {
      clearLocalDemo();
      setSession(null);
      setLoading(false);
      return;
    }
    await supabase.auth.signOut();
    clearCookie();
  };

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSession() {
  return useContext(Ctx);
}
