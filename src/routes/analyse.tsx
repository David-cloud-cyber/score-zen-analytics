import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, ArrowLeftRight, X, Loader2, Lock, Info } from "lucide-react";
import { AppShell, PageTitle } from "@/components/AppShell";
import { TEAMS } from "@/data/teams";
import { Disclaimer } from "@/components/Disclaimer";
import { WinProbabilityDonut, WinProbabilityLegend } from "@/components/WinProbabilityDonut";
import { MarketCard } from "@/components/MarketCard";
import { customAnalysis } from "@/data/analyses";
import { useServerFn } from "@tanstack/react-start";
import { runAnalysis, type AnalysisResult } from "@/lib/analyses.functions";
import { useSession } from "@/hooks/use-session";
import { toast } from "sonner";

export const Route = createFileRoute("/analyse")({
  head: () => ({
    meta: [
      { title: "Comparateur d'équipes — LiveFoot AI" },
      { name: "description", content: "Analysez n'importe quelle rencontre : entrez deux équipes et obtenez une prédiction IA complète (probabilités, marchés, score)." },
      { property: "og:title", content: "Comparateur d'équipes — LiveFoot AI" },
      { property: "og:description", content: "Prédictions IA sur mesure pour n'importe quel match : entrez deux équipes, obtenez l'analyse." },
      { property: "og:url", content: "https://ball-predict-ace.lovable.app/analyse" },
      { name: "twitter:title", content: "Comparateur d'équipes — LiveFoot AI" },
      { name: "twitter:description", content: "Prédictions IA sur mesure pour n'importe quel match de football." },
    ],
    links: [{ rel: "canonical", href: "https://ball-predict-ace.lovable.app/analyse" }],
  }),
  component: AnalysePage,
});

function AnalysePage() {
  const [home, setHome] = useState("Real Madrid");
  const [away, setAway] = useState("FC Barcelone");
  const [live, setLive] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const runFn = useServerFn(runAnalysis);
  const { user } = useSession();
  const navigate = useNavigate();

  const analysis = live ?? customAnalysis(home, away);
  const isReal = live !== null;
  const keyFactors = (live?.keyFactors ?? []) as string[];

  async function onSubmit() {
    if (!user) {
      navigate({ to: "/auth", search: { redirect: "/analyse" } });
      return;
    }
    if (home.trim().length < 2 || away.trim().length < 2) {
      toast.error("Renseignez les deux équipes.");
      return;
    }
    setLoading(true);
    try {
      const result = await runFn({ data: { home: home.trim(), away: away.trim() } });
      setLive(result);
      toast.success("Analyse IA générée — 2 crédits débités.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "L'analyse a échoué.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <PageTitle eyebrow="Comparateur" title="Analyse IA à la demande" />

      <div className="mx-4 rounded-3xl bg-card p-4 ring-1 ring-black/5 dark:ring-white/5 lg:mx-0">
        <TeamInput label="Équipe domicile" value={home} onChange={setHome} />
        <div className="my-3 flex items-center justify-center">
          <button
            onClick={() => { const tmp = home; setHome(away); setAway(tmp); }}
            className="grid size-9 place-items-center rounded-full bg-surface ring-1 ring-black/5 dark:ring-white/10"
            aria-label="Inverser"
          >
            <ArrowLeftRight className="size-4" />
          </button>
        </div>
        <TeamInput label="Équipe extérieure" value={away} onChange={setAway} />
        <button
          onClick={onSubmit}
          disabled={loading}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-3 text-sm font-bold text-background transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : !user ? <Lock className="size-4" /> : <Sparkles className="size-4" />}
          {loading ? "Analyse en cours…" : !user ? "Se connecter pour analyser" : "Lancer l'analyse IA (2 crédits)"}
        </button>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          Modèle Gemini 3.1 Pro · contexte enrichi par API-Football (forme, blessures, H2H).
        </p>
      </div>

      <div className="mt-6 space-y-5 px-4 lg:px-0">
        {!isReal && (
          <div className="flex items-start gap-2 rounded-2xl bg-warn/10 p-3 text-[11px] text-warn ring-1 ring-warn/20">
            <Info className="size-4 shrink-0" />
            <span>Aperçu de démonstration. Lancez une analyse pour obtenir des prédictions IA générées à partir des données réelles.</span>
          </div>
        )}

        <div className="rounded-3xl bg-foreground p-5 text-background">
          <div className="mb-3 flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-brand/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
              <Sparkles className="size-3" /> {isReal ? "Prédiction IA" : "Aperçu"}
            </div>
            <div className="text-[10px] font-bold text-background/60">
              {isReal ? "Gemini 3.1 Pro · v3.0" : "Démo"}
            </div>
          </div>
          <h2 className="mb-4 text-xl font-black leading-tight">
            {home} <span className="text-background/40">vs</span> {away}
          </h2>
          <div className="flex items-center gap-4">
            <WinProbabilityDonut home={analysis.probabilities.home} draw={analysis.probabilities.draw} away={analysis.probabilities.away} size={130} />
            <div className="flex-1">
              <WinProbabilityLegend home={analysis.probabilities.home} draw={analysis.probabilities.draw} away={analysis.probabilities.away} homeName={home} awayName={away} />
              <div className="mt-3 rounded-xl bg-background/5 p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-background/60">Score probable</div>
                <div className="font-mono text-lg font-black tabular-nums">{analysis.probableScore}</div>
              </div>
            </div>
          </div>
        </div>

        {isReal && analysis.aiText && (
          <div className="rounded-3xl bg-card p-4 ring-1 ring-black/5 dark:ring-white/5">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-data/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-data">
              <Sparkles className="size-3" /> Analyse IA
            </div>
            <p className="text-sm leading-relaxed">{analysis.aiText}</p>
            {keyFactors.length > 0 && (
              <ul className="mt-3 space-y-1.5 border-t border-border/60 pt-3 text-xs">
                {keyFactors.map((f: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-brand" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div>
          <h3 className="mb-3 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Marchés recommandés</h3>
          <div className="grid grid-cols-2 gap-3">
            {analysis.markets.slice(0, 6).map((m, i) => (
              <MarketCard key={i} market={{ odd: "—", ...(m as object) } as never} />
            ))}
          </div>
        </div>

        <Disclaimer className="pt-2" />
      </div>
    </AppShell>
  );
}

function TeamInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false);
  const suggestions = TEAMS.filter((t) => t.name.toLowerCase().includes(value.toLowerCase()) && t.name !== value).slice(0, 4);
  return (
    <div className="relative">
      <label className="mb-1 block px-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2 rounded-2xl bg-surface px-3 py-2.5 ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-brand dark:ring-white/10">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          className="flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-muted-foreground"
          placeholder="ex. Real Madrid"
        />
        {value && (
          <button onClick={() => onChange("")} className="text-muted-foreground" aria-label="Effacer">
            <X className="size-4" />
          </button>
        )}
      </div>
      {focused && suggestions.length > 0 && (
        <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl bg-card shadow-lg ring-1 ring-black/5 dark:ring-white/10">
          {suggestions.map((s) => (
            <button
              key={s.id}
              onMouseDown={() => onChange(s.name)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold hover:bg-surface"
            >
              <span className="size-2 rounded-full" style={{ background: s.color }} />
              {s.name}
              <span className="ml-auto text-[10px] text-muted-foreground">{s.country}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
