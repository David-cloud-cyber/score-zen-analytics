import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useId, useRef, useEffect } from "react";
import { Sparkles, ArrowLeftRight, X, Loader2, Lock, Info, Check, Search, Calendar, ShieldCheck, Trophy } from "lucide-react";
import { AppShell, PageTitle } from "@/components/AppShell";
import { Disclaimer } from "@/components/Disclaimer";
import { WinProbabilityDonut, WinProbabilityLegend } from "@/components/WinProbabilityDonut";
import { MarketCard } from "@/components/MarketCard";
import { useServerFn } from "@tanstack/react-start";
import { runAnalysis, type AnalysisResult } from "@/lib/analyses.functions";
import { useSession } from "@/hooks/use-session";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { buildRouteMeta } from "@/lib/seo";

export const Route = createFileRoute("/analyse")({
  validateSearch: (search: Record<string, unknown>) => ({
    home: typeof search.home === "string" ? search.home : "",
    away: typeof search.away === "string" ? search.away : "",
  }),
  head: () =>
    buildRouteMeta({
      path: "/analyse",
      title: "Comparateur d'équipes & Prédictions IA",
      description:
        "Analysez n'importe quelle rencontre : entrez deux équipes et obtenez une prédiction IA complète (probabilités, marchés, score).",
    }),
  component: AnalysePage,
});

// Popular teams database for instant selection & autocompletion
const POPULAR_TEAMS = [
  { name: "Real Madrid", league: "LaLiga 🇪🇸", logo: "https://media.api-sports.io/football/teams/541.png" },
  { name: "FC Barcelone", league: "LaLiga 🇪🇸", logo: "https://media.api-sports.io/football/teams/529.png" },
  { name: "Paris Saint-Germain", league: "Ligue 1 🇫🇷", logo: "https://media.api-sports.io/football/teams/85.png" },
  { name: "Manchester City", league: "Premier League 🏴󠁧󠁢󠁥󠁮󠁧󠁿", logo: "https://media.api-sports.io/football/teams/50.png" },
  { name: "Arsenal", league: "Premier League 🏴󠁧󠁢󠁥󠁮󠁧󠁿", logo: "https://media.api-sports.io/football/teams/42.png" },
  { name: "Bayern Munich", league: "Bundesliga 🇩🇪", logo: "https://media.api-sports.io/football/teams/157.png" },
  { name: "Inter Milan", league: "Serie A 🇮🇹", logo: "https://media.api-sports.io/football/teams/505.png" },
  { name: "Liverpool FC", league: "Premier League 🏴󠁧󠁢󠁥󠁮󠁧󠁿", logo: "https://media.api-sports.io/football/teams/40.png" },
  { name: "Chelsea FC", league: "Premier League 🏴󠁧󠁢󠁥󠁮󠁧󠁿", logo: "https://media.api-sports.io/football/teams/49.png" },
  { name: "Juventus", league: "Serie A 🇮🇹", logo: "https://media.api-sports.io/football/teams/496.png" },
  { name: "Borussia Dortmund", league: "Bundesliga 🇩🇪", logo: "https://media.api-sports.io/football/teams/165.png" },
  { name: "Olympique de Marseille", league: "Ligue 1 🇫🇷", logo: "https://media.api-sports.io/football/teams/81.png" },
];

function AnalysePage() {
  const { home: homeParam, away: awayParam } = useSearch({ from: "/analyse" });
  const [home, setHome] = useState(homeParam ?? "");
  const [away, setAway] = useState(awayParam ?? "");
  const [live, setLive] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [swapping, setSwapping] = useState(false);
  const autoLaunched = useRef(false);

  const runFn = useServerFn(runAnalysis);
  const { user, loading: sessionLoading } = useSession();
  const navigate = useNavigate();

  const keyFactors = (live?.keyFactors ?? []) as string[];

  // Rediriger vers /auth si l'utilisateur n'est pas connecté (après chargement)
  useEffect(() => {
    if (!sessionLoading && !user) {
      navigate({ to: "/auth", search: { redirect: "/analyse" } });
    }
  }, [sessionLoading, user, navigate]);

  // Auto-lancer l'analyse quand les équipes viennent de la page match
  useEffect(() => {
    if (autoLaunched.current) return;
    if (sessionLoading || !user) return;
    if (homeParam && awayParam) {
      autoLaunched.current = true;
      onSubmit();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, user, homeParam, awayParam]);

  // Swap animation handler
  const handleSwap = () => {
    setSwapping(true);
    const tmp = home;
    setHome(away);
    setAway(tmp);
    setTimeout(() => setSwapping(false), 300);
  };

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
    setLoadingStep("Extraction des données H2H & formes récentes...");
    
    const steps = [
      "Extraction des données H2H & formes récentes...",
      "Analyse de l'infirmerie et tactiques...",
      "Calcul des probabilités 1X2 via IA...",
      "Génération du rapport prédictif...",
    ];
    let stepIdx = 0;
    const interval = setInterval(() => {
      stepIdx = (stepIdx + 1) % steps.length;
      setLoadingStep(steps[stepIdx]);
    }, 1200);

    try {
      const result = await runFn({ data: { home: home.trim(), away: away.trim() } });
      setLive(result);
      toast.success("Analyse IA générée — 2 crédits débités.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "L'analyse a échoué.");
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  }

  const isBothSelected = home.trim().length >= 2 && away.trim().length >= 2;

  return (
    <AppShell>
      <PageTitle eyebrow="Comparateur IA" title="Analyse de Match sur Mesure" />

      {/* Main Team Selector Container */}
      <div className="mx-4 rounded-3xl bg-card p-5 shadow-lg ring-1 ring-black/5 dark:ring-white/5 lg:mx-0">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid size-7 place-items-center rounded-lg bg-brand/10 text-brand">
              <Trophy className="size-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sélection des Équipes</span>
          </div>
          <span className="rounded-full bg-surface px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
            Coût : 2 crédits
          </span>
        </div>

        <div className="space-y-3">
          {/* Home Team Input */}
          <TeamAutocompleteInput
            label="Équipe Domicile 🏠"
            value={home}
            onChange={setHome}
            placeholder="ex. Real Madrid, PSG, Arsenal..."
          />

          {/* Swap Button */}
          <div className="my-1 flex items-center justify-center">
            <button
              onClick={handleSwap}
              type="button"
              className={cn(
                "group flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs font-bold ring-1 ring-black/5 transition-all hover:bg-foreground hover:text-background active:scale-95 dark:ring-white/10",
                swapping && "rotate-180 scale-110",
              )}
              aria-label="Inverser les équipes"
            >
              <ArrowLeftRight className={cn("size-4 transition-transform group-hover:scale-110", swapping && "rotate-180")} />
              <span className="text-[11px]">Inverser Domicile / Extérieur</span>
            </button>
          </div>

          {/* Away Team Input */}
          <TeamAutocompleteInput
            label="Équipe Extérieure ✈️"
            value={away}
            onChange={setAway}
            placeholder="ex. FC Barcelone, Man City, Inter..."
          />
        </div>

        {/* Popular Quick Select Badges */}
        <div className="mt-4 border-t border-border/50 pt-3">
          <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            Raccourcis rapides :
          </div>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR_TEAMS.slice(0, 6).map((team) => (
              <button
                key={team.name}
                type="button"
                onClick={() => {
                  if (!home) setHome(team.name);
                  else if (!away && home !== team.name) setAway(team.name);
                  else setHome(team.name);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-surface px-2.5 py-1 text-xs font-medium ring-1 ring-black/5 transition-transform hover:scale-105 active:scale-95 dark:ring-white/10"
              >
                <span>{team.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Match Matcher Notice */}
        {isBothSelected && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-brand/10 p-3 text-xs font-medium text-brand">
            <ShieldCheck className="size-4 shrink-0" />
            <span>
              Confrontation configurée : <strong>{home}</strong> vs <strong>{away}</strong>. Contexte temps réel injecté.
            </span>
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={onSubmit}
          disabled={loading || !isBothSelected}
          className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-foreground py-3.5 text-sm font-bold text-background shadow-md transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin text-brand" />
              <span>{loadingStep}</span>
            </>
          ) : !user ? (
            <>
              <Lock className="size-4" />
              <span>Se connecter pour lancer l'analyse</span>
            </>
          ) : (
            <>
              <Sparkles className="size-4 text-warn animate-pulse" />
              <span>Lancer l'analyse IA (2 crédits)</span>
            </>
          )}
        </button>
        <p className="mt-2.5 text-center text-[10px] text-muted-foreground">
          Calculé par Gemini 3.1 Pro avec statistiques d'effectif et historique H2H.
        </p>
      </div>

      {/* Results Section */}
      <div className="mt-6 space-y-5 px-4 lg:px-0">
        {!live ? (
          <div className="flex items-start gap-3 rounded-2xl bg-surface p-4 text-[12px] leading-relaxed text-muted-foreground ring-1 ring-black/5 dark:ring-white/10">
            <Info className="size-5 shrink-0 text-brand" />
            <div>
              <p className="font-bold text-foreground">Comment fonctionne l'Analyse IA ?</p>
              <p className="mt-0.5">
                Sélectionnez l'équipe à domicile et l'équipe à l'extérieur ci-dessus. L'algorithme évaluera les probabilités 1X2,
                le score exact le plus probable et recommandera les meilleurs marchés statistiques.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-3xl bg-foreground p-5 text-background shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-brand/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
                  <Sparkles className="size-3" /> Prédiction IA
                </div>
                <div className="text-[10px] font-bold text-background/60">Gemini 3.1 Pro</div>
              </div>
              <h2 className="mb-4 text-xl font-black leading-tight">
                {home} <span className="text-background/40">vs</span> {away}
              </h2>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <WinProbabilityDonut home={live.probabilities.home} draw={live.probabilities.draw} away={live.probabilities.away} size={130} />
                <div className="flex-1">
                  <WinProbabilityLegend home={live.probabilities.home} draw={live.probabilities.draw} away={live.probabilities.away} homeName={home} awayName={away} />
                  <div className="mt-3 rounded-xl bg-background/5 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-background/60">Score probable</div>
                    <div className="font-mono text-lg font-black tabular-nums">{live.probableScore}</div>
                  </div>
                </div>
              </div>
            </div>

            {live.aiText && (
              <div className="rounded-3xl bg-card p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-data/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-data">
                  <Sparkles className="size-3" /> Synthèse Tactique
                </div>
                <p className="text-sm leading-relaxed">{live.aiText}</p>
                {keyFactors.length > 0 && (
                  <div className="mt-4 border-t border-border/60 pt-3">
                    <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Facteurs Clés :</div>
                    <ul className="space-y-2 text-xs">
                      {keyFactors.map((f: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="mt-0.5 size-3.5 shrink-0 text-brand" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div>
              <h3 className="mb-3 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Marchés recommandés</h3>
              <div className="grid grid-cols-2 gap-3">
                {live.markets.slice(0, 6).map((m, i) => (
                  <MarketCard key={i} market={m} />
                ))}
              </div>
            </div>
          </>
        )}

        <Disclaimer className="pt-2" />
      </div>
    </AppShell>
  );
}

function TeamAutocompleteInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputId = useId();

  const filtered = value.trim().length >= 1
    ? POPULAR_TEAMS.filter((t) => t.name.toLowerCase().includes(value.toLowerCase()))
    : [];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <label htmlFor={inputId} className="mb-1 block px-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center gap-2.5 rounded-2xl bg-surface px-3.5 py-3 ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-brand dark:ring-white/10">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          id={inputId}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-muted-foreground"
          placeholder={placeholder}
          autoComplete="off"
        />
        {value && (
          <button type="button" onClick={() => onChange("")} className="text-muted-foreground hover:text-foreground" aria-label="Effacer">
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-2xl bg-card p-1.5 shadow-xl ring-1 ring-black/10 dark:ring-white/10">
          {filtered.map((team) => (
            <button
              key={team.name}
              type="button"
              onClick={() => {
                onChange(team.name);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold hover:bg-surface"
            >
              <div className="flex items-center gap-2">
                <img src={team.logo} alt="" className="size-4 object-contain" />
                <span>{team.name}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{team.league}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
