import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useId, useRef, useEffect } from "react";
import {
  Sparkles,
  ArrowLeftRight,
  X,
  Loader2,
  Lock,
  Info,
  Check,
  ChevronDown,
  Search,
  Calendar,
  ShieldCheck,
  Trophy,
  ArrowRight,
} from "lucide-react";
import { AppShell, PageTitle } from "@/components/AppShell";
import { PremiumCta } from "@/components/PremiumCta";
import { Disclaimer } from "@/components/Disclaimer";
import { WinProbabilityDonut, WinProbabilityLegend } from "@/components/WinProbabilityDonut";
import { MarketCard } from "@/components/MarketCard";
import { useServerFn } from "@tanstack/react-start";
import { runAnalysis, type AnalysisResult } from "@/lib/analyses.functions";
import { getTeams, type TeamRow } from "@/lib/football.functions";
import { useSession } from "@/hooks/use-session";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { buildRouteMeta, breadcrumbSchema, faqSchema, SPEAKABLE, ORG } from "@/lib/seo";
import { track, lastCtaSource } from "@/lib/analytics";
import { requestPremiumPrompt } from "@/hooks/use-premium-prompt";
import { DEMO_ANALYSIS, isLocalDemo } from "@/lib/local-demo";

const ANALYSE_ANSWER =
  "Pour obtenir une prédiction football avec LiveFoot, saisissez l'équipe à domicile et l'équipe à l'extérieur, puis lancez l'analyse. Le moteur LiveFoot recoupe forme récente, confrontations directes, blessures, classement, données live et marché disponible, puis renvoie les probabilités 1X2, le score le plus probable et les marchés recommandés avec un niveau de confiance. Une analyse coûte 3 crédits.";

const ANALYSE_FAQ = [
  {
    q: "Comment fonctionne la prédiction LiveFoot ?",
    a: "Le moteur LiveFoot agrège les données officielles du match (forme récente, confrontations directes, blessures, classement, statistiques offensives et défensives, cotes et données live lorsque disponibles), puis calcule des probabilités 1X2, un score probable et des marchés assortis d'un indice de confiance.",
  },
  {
    q: "Les prédictions IA sont-elles fiables à 100 % ?",
    a: "Non. Aucune prédiction sportive n'est certaine. Les analyses LiveFoot sont statistiques et informatives : elles aident à comprendre un rapport de force, mais ne garantissent aucun résultat ni aucun gain.",
  },
  {
    q: "Combien coûte une analyse ?",
    a: "Une analyse consomme 3 crédits. Chaque nouveau compte reçoit 5 crédits offerts ; les abonnés Premium disposent de 100 crédits par mois et peuvent acheter des packs supplémentaires.",
  },
  {
    q: "Puis-je analyser n'importe quel match ?",
    a: "Oui, toute rencontre couverte par nos données football : Ligue 1, Premier League, Liga, Serie A, Bundesliga, Ligue des champions, ainsi que de nombreuses compétitions africaines et internationales.",
  },
];

export const Route = createFileRoute("/analyse")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { home: string; away: string; matchId?: string } => {
    const rawMatchId = search.matchId;
    const matchId =
      typeof rawMatchId === "number" && Number.isInteger(rawMatchId) && rawMatchId > 0
        ? String(rawMatchId)
        : typeof rawMatchId === "string" && /^\d+$/.test(rawMatchId.trim())
          ? rawMatchId.trim()
          : undefined;

    return {
      home: typeof search.home === "string" ? search.home : "",
      away: typeof search.away === "string" ? search.away : "",
      ...(matchId ? { matchId } : {}),
    };
  },
  head: () => {
    const base = buildRouteMeta({
      path: "/analyse",
      title: "Prédictions IA & analyse d'équipes",
      description:
        "Analysez n'importe quelle rencontre : entrez deux équipes et obtenez une prédiction IA complète (probabilités, marchés, score).",
      alternates: [
        { language: "fr", path: "/analyse" },
        { language: "en", path: "/en/analyse" },
        { language: "x-default", path: "/analyse" },
      ],
    });
    return {
      ...base,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(faqSchema(ANALYSE_FAQ)),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Prédictions IA LiveFoot",
            applicationCategory: "SportsApplication",
            operatingSystem: "Web",
            inLanguage: "fr",
            url: "https://www.livefoot.fun/analyse",
            publisher: ORG,
            speakable: SPEAKABLE,
            offers: { "@type": "Offer", price: "0", priceCurrency: "XAF" },
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify(
            breadcrumbSchema([
              { name: "Accueil", path: "/" },
              { name: "Analyse", path: "/analyse" },
            ]),
          ),
        },
      ],
    };
  },
  component: AnalysePage,
});

type TeamSuggestion = {
  id?: number;
  name: string;
  league: string;
  logo: string;
};

// Repères de démarrage : la recherche distante API-Football complète toujours
// cette liste dès que l'utilisateur saisit au moins deux caractères.
const POPULAR_TEAMS: TeamSuggestion[] = [
  {
    name: "Real Madrid",
    league: "LaLiga 🇪🇸",
    logo: "https://media.api-sports.io/football/teams/541.png",
  },
  {
    name: "FC Barcelone",
    league: "LaLiga 🇪🇸",
    logo: "https://media.api-sports.io/football/teams/529.png",
  },
  {
    name: "Paris Saint-Germain",
    league: "Ligue 1 🇫🇷",
    logo: "https://media.api-sports.io/football/teams/85.png",
  },
  {
    name: "Manchester City",
    league: "Premier League 🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    logo: "https://media.api-sports.io/football/teams/50.png",
  },
  {
    name: "Arsenal",
    league: "Premier League 🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    logo: "https://media.api-sports.io/football/teams/42.png",
  },
  {
    name: "Bayern Munich",
    league: "Bundesliga 🇩🇪",
    logo: "https://media.api-sports.io/football/teams/157.png",
  },
  {
    name: "Inter Milan",
    league: "Serie A 🇮🇹",
    logo: "https://media.api-sports.io/football/teams/505.png",
  },
  {
    name: "Liverpool FC",
    league: "Premier League 🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    logo: "https://media.api-sports.io/football/teams/40.png",
  },
  {
    name: "Chelsea FC",
    league: "Premier League 🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    logo: "https://media.api-sports.io/football/teams/49.png",
  },
  {
    name: "Juventus",
    league: "Serie A 🇮🇹",
    logo: "https://media.api-sports.io/football/teams/496.png",
  },
  {
    name: "Borussia Dortmund",
    league: "Bundesliga 🇩🇪",
    logo: "https://media.api-sports.io/football/teams/165.png",
  },
  {
    name: "Olympique de Marseille",
    league: "Ligue 1 🇫🇷",
    logo: "https://media.api-sports.io/football/teams/81.png",
  },
] satisfies TeamSuggestion[];

function AnalysePage() {
  const demoMode = isLocalDemo();
  const {
    home: homeParam,
    away: awayParam,
    matchId: matchIdParam,
  } = useSearch({ from: "/analyse" });
  const [home, setHome] = useState(homeParam ?? (demoMode ? "Arsenal" : ""));
  const [away, setAway] = useState(awayParam ?? (demoMode ? "Chelsea" : ""));
  const [live, setLive] = useState<AnalysisResult | null>(demoMode ? DEMO_ANALYSIS : null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);
  const autoLaunched = useRef(false);

  const runFn = useServerFn(runAnalysis);
  const { user, loading: sessionLoading } = useSession();
  const navigate = useNavigate();

  const keyFactors = (live?.keyFactors ?? []) as string[];

  // Conversion : arrivée sur la page d'analyse (attribuée au dernier CTA cliqué)
  useEffect(() => {
    track("analyse_view", { source: lastCtaSource() ?? "direct" });
  }, []);

  // Rediriger vers /auth si l'utilisateur n'est pas connecté (après chargement)
  useEffect(() => {
    if (!demoMode && !sessionLoading && !user) {
      const context = [homeParam, awayParam].every(Boolean)
        ? `/analyse?home=${encodeURIComponent(homeParam)}&away=${encodeURIComponent(awayParam)}`
        : "/analyse";
      navigate({
        to: "/auth",
        search: { mode: "signup", redirect: context, source: "analyse_gate" },
      });
    }
  }, [demoMode, sessionLoading, user, navigate, homeParam, awayParam]);

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
      const context = home.trim() && away.trim()
        ? `/analyse?home=${encodeURIComponent(home.trim())}&away=${encodeURIComponent(away.trim())}`
        : "/analyse";
      navigate({
        to: "/auth",
        search: { mode: "signup", redirect: context, source: "analyse_gate" },
      });
      return;
    }
    if (home.trim().length < 2 || away.trim().length < 2) {
      toast.error("Renseignez les deux équipes.");
      return;
    }
    if (demoMode) {
      setLive(DEMO_ANALYSIS);
      toast.success("Aperçu local : analyse fictive affichée, aucun crédit débité.");
      return;
    }
    track("analyse_run", { source: lastCtaSource() ?? "direct" });
    setLoading(true);
    setAnalysisError(null);
    setLoadingStep("Extraction des données H2H & formes récentes...");

    const steps = [
      "Extraction des données H2H & formes récentes...",
      "Analyse de l'infirmerie et tactiques...",
      "Calcul des probabilités et calibration des données...",
      "Finalisation du rapport prédictif...",
    ];
    let stepIdx = 0;
    const interval = setInterval(() => {
      stepIdx = (stepIdx + 1) % steps.length;
      setLoadingStep(steps[stepIdx]);
    }, 1200);

    try {
      const result = await runFn({
        data: {
          home: home.trim(),
          away: away.trim(),
          matchId: matchIdParam || undefined,
          requestId: crypto.randomUUID(),
        },
      });
      setLive(result);
      track("analysis_result_view", {
        source: lastCtaSource() ?? "direct",
        matchId: matchIdParam ?? "",
      });
      window.dispatchEvent(new Event("livefoot:analysis-completed"));
      requestPremiumPrompt("first_analysis");
      toast.success("Analyse IA générée — 3 crédits débités.");
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : "";
      const message = /invalid_type|matchId|Identifiant de match/i.test(rawMessage)
        ? "Le match n’a pas pu être identifié. Ouvrez l’analyse depuis la fiche du match ou vérifiez les équipes."
        : /Données statistiques insuffisantes|API Football|momentanément indisponible/i.test(
              rawMessage,
            )
          ? "Certaines informations sont encore en cours de mise à jour. Réessayez dans quelques instants."
          : /Crédits insuffisants|Limite atteinte|Limite quotidienne|Profil introuvable|Impossible de lire votre profil/i.test(
                rawMessage,
              )
            ? rawMessage
            : "L’analyse n’a pas pu être générée. Réessayez dans quelques secondes.";
      setAnalysisError(message);
      toast.error(message);
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  }

  const isBothSelected = home.trim().length >= 2 && away.trim().length >= 2;

  return (
    <AppShell>
      <PageTitle eyebrow="Prédictions IA" title="Analyse de Match sur Mesure" />

      {/* Main Team Selector Container */}
      <div className="mx-4 animate-rise rounded-xl border border-border/70 bg-card p-4 shadow-none lg:mx-0">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid size-7 place-items-center rounded-lg bg-brand/10 text-brand">
              <Trophy className="size-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Sélection des Équipes
            </span>
          </div>
          <span className="rounded-full bg-surface px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
            Coût : 3 crédits
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
                "group inline-flex items-center gap-1.5 rounded-full bg-surface px-2 py-1 text-[10px] font-bold ring-1 ring-black/5 transition-all hover:bg-foreground hover:text-background active:scale-95 dark:ring-white/10",
                swapping && "rotate-180 scale-110",
              )}
              aria-label="Inverser les équipes"
            >
              <ArrowLeftRight
                className={cn(
                  "size-3.5 transition-transform group-hover:scale-110",
                  swapping && "rotate-180",
                )}
              />
              <span className="hidden text-[11px] sm:inline">Inverser</span>
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

        {/* Match Matcher Notice */}
        {isBothSelected && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-brand/10 p-3 text-xs font-medium text-brand">
            <ShieldCheck className="size-4 shrink-0" />
            <span>
              Confrontation configurée : <strong>{home}</strong> vs <strong>{away}</strong>.
              Contexte temps réel injecté.
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
              <span>
                {demoMode ? "Voir l'analyse démo (0 crédit)" : "Lancer l'analyse (3 crédits)"}
              </span>
            </>
          )}
        </button>
        <p className="mt-2.5 text-center text-[10px] text-muted-foreground">
          Estimation statistique LiveFoot basée sur la forme, les absences, les confrontations
          directes et les données de marché disponibles.
        </p>
        {!demoMode && <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-brand/20 bg-brand/5 px-3 py-2.5"><p className="text-[11px] text-muted-foreground">100 crédits mensuels pour analyser plus de matchs.</p><PremiumCta location="analysis_form" compact label="Voir Premium" /></div>}
        {analysisError && (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-warn/30 bg-warn/5 p-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-foreground">Analyse non finalisée</p>
              <p className="mt-1">{analysisError}</p>
            </div>
            <button
              type="button"
              onClick={onSubmit}
              disabled={loading}
              className="shrink-0 rounded-xl bg-foreground px-3 py-2 font-bold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Réessayer
            </button>
          </div>
        )}
        {live?.dataQuality?.level === "partial" && !analysisError && (
          <div className="mt-4 rounded-2xl border border-brand/25 bg-brand/5 p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Analyse disponible avec les informations vérifiées.</p>
            <p className="mt-1">Certaines statistiques sont encore en cours de mise à jour ; la confiance a été ajustée en conséquence.</p>
          </div>
        )}
      </div>

      {/* Results Section */}
      <div className="mt-5 space-y-4 px-4 lg:px-0">
        {!live ? (
          <div className="flex items-start gap-3 rounded-2xl bg-surface p-4 text-[12px] leading-relaxed text-muted-foreground ring-1 ring-black/5 dark:ring-white/10">
            <Info className="size-5 shrink-0 text-brand" />
            <div>
              <p className="font-bold text-foreground">Comment fonctionne l'analyse LiveFoot ?</p>
              <p className="mt-0.5">
                Sélectionnez l'équipe à domicile et l'équipe à l'extérieur ci-dessus. L'algorithme
                évaluera les probabilités 1X2, le score exact le plus probable et recommandera les
                meilleurs marchés statistiques.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="score-dark-surface animate-score-pop rounded-xl bg-[#181818] p-5 text-[#f7f7f7] shadow-none">
              <div className="mb-3 flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-brand/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
                  <Sparkles className="size-3" /> Prédiction LiveFoot
                </div>
                <div className="text-[10px] font-bold text-[#f7f7f7]/60">Analyse multicritère</div>
              </div>
              <h2 className="mb-4 text-xl font-black leading-tight">
                {home} <span className="text-[#f7f7f7]/40">vs</span> {away}
              </h2>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <WinProbabilityDonut
                  home={live.probabilities.home}
                  draw={live.probabilities.draw}
                  away={live.probabilities.away}
                  size={130}
                />
                <div className="flex-1">
                  <WinProbabilityLegend
                    home={live.probabilities.home}
                    draw={live.probabilities.draw}
                    away={live.probabilities.away}
                    homeName={home}
                    awayName={away}
                  />
                  <div className="mt-3 rounded-xl bg-background/5 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#f7f7f7]/60">
                      Score probable
                    </div>
                    <div className="font-mono text-lg font-black tabular-nums">
                      {live.probableScore}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {live.aiText && (
              <div className="animate-rise rounded-xl border border-border/70 bg-card p-5 shadow-none">
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-data/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-data">
                  <Sparkles className="size-3" /> Synthèse Tactique
                </div>
                <p className="text-sm leading-relaxed">{live.aiText}</p>
                {keyFactors.length > 0 && (
                  <div className="mt-4 border-t border-border/60 pt-3">
                    <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      Facteurs Clés :
                    </div>
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
              <h3 className="mb-3 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                Marchés recommandés
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {live.markets.slice(0, 6).map((m, i) => (
                  <MarketCard key={i} market={m} />
                ))}
              </div>
            </div>

            {!demoMode && (
              <div className="flex flex-col gap-3 rounded-xl border border-brand/20 bg-brand/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black">Besoin de plus d'analyses ?</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Premium inclut 100 crédits par mois, soit environ 33 analyses, plus l'historique complet.
                  </p>
                </div>
                <Link
                  to="/premium"
                  search={{}}
                  onClick={() => track("premium_cta_click", { location: "analysis_result" })}
                  className="inline-flex shrink-0 items-center justify-center rounded-xl bg-brand px-3.5 py-2 text-xs font-black text-brand-foreground transition-transform active:scale-95"
                >
                  Découvrir Premium <ArrowRight className="ml-1 size-3.5" />
                </Link>
              </div>
            )}
          </>
        )}

        {/* Le contenu éditorial reste indexable sans surcharger le parcours principal. */}
        <details className="group rounded-xl border border-border/70 bg-surface/30 p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-black marker:hidden">
            <span>Comprendre la méthode et les questions fréquentes</span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-4 space-y-5">
            <section aria-label="Réponse rapide" className="border-l-4 border-brand bg-brand/5 p-4">
              <h2 className="mb-2 text-[11px] font-black uppercase tracking-widest text-brand">
                Comment obtenir une prédiction IA sur un match ?
              </h2>
              <p data-answer className="text-sm font-medium leading-relaxed text-foreground">
                {ANALYSE_ANSWER}
              </p>
            </section>

            <section aria-label="Questions fréquentes" className="space-y-2">
              <h2 className="text-base font-black tracking-tight">Questions fréquentes</h2>
              {ANALYSE_FAQ.map((f) => (
                <details key={f.q} className="rounded-xl border border-border/70 bg-surface/40 p-3">
                  <summary className="cursor-pointer text-sm font-black">{f.q}</summary>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </section>
          </div>
        </details>

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
  const [remoteTeams, setRemoteTeams] = useState<TeamRow[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const getTeamsFn = useServerFn(getTeams);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) {
      setRemoteTeams([]);
      setRemoteLoading(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      setRemoteLoading(true);
      void getTeamsFn({ data: { search: query } })
        .then((teams) => {
          if (active) setRemoteTeams(teams);
        })
        .catch(() => {
          if (active) setRemoteTeams([]);
        })
        .finally(() => {
          if (active) setRemoteLoading(false);
        });
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [getTeamsFn, value]);

  const query = value.trim().toLowerCase();
  const remoteSuggestions: TeamSuggestion[] = remoteTeams.map((team) => ({
    id: team.id,
    name: team.name,
    league: [team.country, team.code].filter(Boolean).join(" · "),
    logo: team.logo,
  }));
  const localSuggestions =
    query.length >= 1
      ? POPULAR_TEAMS.filter((team) => team.name.toLowerCase().includes(query))
      : [];
  const filtered = [...remoteSuggestions, ...localSuggestions].filter(
    (team, index, all) =>
      all.findIndex((candidate) => candidate.name.toLowerCase() === team.name.toLowerCase()) === index,
  ).slice(0, 8);

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
      <label
        htmlFor={inputId}
        className="mb-1 block px-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground"
      >
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
          <button
            type="button"
            onClick={() => onChange("")}
            className="grid size-7 place-items-center rounded-lg bg-surface text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Effacer"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {open && (filtered.length > 0 || remoteLoading) && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-2xl bg-card p-1.5 shadow-xl ring-1 ring-black/10 dark:ring-white/10">
          {remoteLoading && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin text-brand" /> Recherche des équipes…
            </div>
          )}
          {filtered.map((team) => (
            <button
              key={`${team.id ?? "popular"}-${team.name}`}
              type="button"
              onClick={() => {
                onChange(team.name);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-xl bg-card px-3 py-2 text-left text-xs font-semibold transition-colors hover:bg-surface"
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
