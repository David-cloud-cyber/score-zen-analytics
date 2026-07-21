import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Sparkles, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Connexion — LiveFoot AI" },
      { name: "description", content: "Connectez-vous ou créez votre compte LiveFoot AI pour accéder à vos analyses et favoris." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  // If already signed in, bounce
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: (redirect as never) ?? "/" });
    });
  }, [navigate, redirect]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bienvenue !");
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
        toast.success("Compte créé ! Vous pouvez vous connecter.");
      }
      const dest = typeof redirect === "string" && redirect.startsWith("/") ? redirect : "/";
      navigate({ to: dest as never });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      const dest = typeof redirect === "string" && redirect.startsWith("/") ? redirect : "/";
      navigate({ to: dest as never });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connexion Google impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2.5">
          <div className="grid size-10 place-items-center rounded-xl bg-foreground text-background">
            <span className="text-[13px] font-black italic tracking-tighter">LF</span>
          </div>
          <div className="text-lg font-bold tracking-tight">
            LiveFoot <span className="text-brand">AI</span>
          </div>
        </Link>

        <div className="rounded-3xl bg-card p-6 ring-1 ring-black/5 shadow-lg">
          <div className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-brand">
            {mode === "signin" ? "Connexion" : "Inscription"}
          </div>
          <h1 className="mb-1 text-2xl font-black leading-tight">
            {mode === "signin" ? "Content de vous revoir" : "Créez votre compte"}
          </h1>
          <p className="mb-5 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Retrouvez vos favoris, crédits et analyses."
              : "10 crédits offerts à l'inscription."}
          </p>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background py-3 text-sm font-bold transition-transform active:scale-[0.98] disabled:opacity-50"
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
                  placeholder="Alex"
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
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-3 text-sm font-bold text-background transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <>
                {mode === "signin" ? "Se connecter" : "Créer mon compte"} <ArrowRight className="size-4" />
              </>}
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
      <div className="flex items-center gap-2 rounded-2xl bg-surface px-3 py-2.5 ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-brand">
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
