import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Sparkles, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { applyReferral } from "@/lib/referral.functions";
import livefootIcon from "@/assets/livefoot-icon.png.asset.json";

const searchSchema = z.object({
  redirect: z.string().optional(),
  ref: z.string().optional(), // code de parrainage
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Connexion & Inscription — Livefoot IA" },
      { name: "description", content: "Connectez-vous ou créez votre compte Livefoot IA. 10 crédits d'analyse IA offerts à l'inscription." },
      { property: "og:title", content: "Connexion & Inscription — Livefoot IA" },
      { property: "og:description", content: "Rejoignez Livefoot IA : 10 crédits offerts, favoris et historique personnalisés." },
      { property: "og:url", content: "https://www.livefoot.fun/auth" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://www.livefoot.fun/auth" }],
  }),
  component: AuthPage,
});

const PENDING_REF_KEY = "lfai_pending_ref";

function AuthPage() {
  const navigate = useNavigate();
  const { redirect, ref } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const applyReferralFn = useServerFn(applyReferral);

  // Persister le code de parrainage dans sessionStorage pour ne pas le perdre
  // si la page se recharge ou si l'utilisateur passe par Google OAuth.
  useEffect(() => {
    if (ref) {
      try {
        sessionStorage.setItem(PENDING_REF_KEY, ref.toUpperCase());
      } catch {
        // SSR safety
      }
      // Basculer automatiquement en mode inscription si on arrive avec un code
      setMode("signup");
    }
  }, [ref]);

  // Si déjà connecté, auto-redirect
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: (redirect as never) ?? "/" });
    });
  }, [navigate, redirect]);

  /** Applique le code de parrainage stocké en session après connexion/inscription. */
  async function tryApplyPendingReferral() {
    try {
      const code = sessionStorage.getItem(PENDING_REF_KEY);
      if (!code) return;
      sessionStorage.removeItem(PENDING_REF_KEY);
      const result = await applyReferralFn({ data: { referralCode: code } });
      if (result.ok) {
        toast.success("🎉 Code de parrainage appliqué ! Votre parrain reçoit +5 crédits.");
      }
    } catch {
      // Silencieux — ne pas bloquer la navigation
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bienvenue ! Connexion réussie.");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Compte créé avec succès ! Vous pouvez vous connecter.");
      }
      await tryApplyPendingReferral();
      const dest = typeof redirect === "string" && redirect.startsWith("/") ? redirect : "/";
      navigate({ to: dest as never });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue lors de l'authentification.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const callbackUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : "https://www.livefoot.fun/auth/callback";
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl },
      });
      if (error) throw error;
      // Note : le code de parrainage sera appliqué au retour depuis /auth/callback
      // via auth.callback.tsx qui peut lire sessionStorage.
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connexion Google via Supabase impossible.");
    } finally {
      setLoading(false);
    }
  }

  const hasRefCode = !!(ref || (() => { try { return sessionStorage.getItem(PENDING_REF_KEY); } catch { return null; } })());

  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2.5">
          <img
            src={livefootIcon.url}
            alt="Livefoot IA"
            className="size-10 shrink-0 rounded-xl object-contain"
            width={40}
            height={40}
          />
          <div className="text-lg font-bold tracking-tight">Livefoot IA</div>
        </Link>

        {/* Bannière code parrain */}
        {hasRefCode && mode === "signup" && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-brand/10 px-4 py-3 ring-1 ring-brand/20">
            <Sparkles className="size-4 shrink-0 text-brand" />
            <p className="text-xs font-bold text-brand">
              Invitation activée — votre parrain recevra +5 crédits dès votre inscription !
            </p>
          </div>
        )}

        <div className="rounded-3xl bg-card p-6 shadow-xl ring-1 ring-black/5 dark:ring-white/5">
          <div className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-brand">
            {mode === "signin" ? "Connexion" : "Inscription"}
          </div>
          <h1 className="mb-1 text-2xl font-black leading-tight">
            {mode === "signin" ? "Content de vous revoir" : "Créez votre compte"}
          </h1>
          <p className="mb-5 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Retrouvez vos favoris, crédits et prédictions."
              : "10 crédits offerts à l'inscription."}
          </p>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background py-3 text-sm font-bold shadow-xs transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            <GoogleIcon /> Continuer avec Google
          </button>

          <div className="my-4 flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> ou email <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            {mode === "signup" && (
              <Field label="Nom d'affichage" icon={<Sparkles className="size-4" />}>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="ex. Alex"
                  className="flex-1 bg-transparent text-sm outline-none"
                />
              </Field>
            )}
            <Field label="Email" icon={<Mail className="size-4" />}>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </Field>
            <Field label="Mot de passe" icon={<Lock className="size-4" />}>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </Field>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-3.5 text-sm font-bold text-background shadow-md transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  {mode === "signin" ? "Se connecter" : "Créer mon compte"} <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>

          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? (
              <>Pas encore de compte ? <span className="font-bold text-brand">S'inscrire</span></>
            ) : (
              <>Déjà inscrit ? <span className="font-bold text-brand">Se connecter</span></>
            )}
          </button>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          En continuant, vous acceptez nos{" "}
          <Link to="/mentions-legales" className="underline">
            CGU et notre politique de confidentialité
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 px-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2.5 rounded-2xl bg-surface px-3.5 py-3 ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-brand dark:ring-white/10">
        <span className="text-muted-foreground" aria-hidden>{icon}</span>
        {children}
      </div>
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.87 0-5.29-1.94-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.05l3.66 2.84C6.71 7.32 9.13 5.38 12 5.38z"/>
    </svg>
  );
}
