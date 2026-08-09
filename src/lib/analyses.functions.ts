import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  blendPredictions,
  buildStatisticalPrediction,
  type CommunitySnapshot,
  type H2HMatch,
  type LiveSnapshot,
  type MatchSignals,
  type OddsSnapshot,
  type StatisticalPrediction,
  type TeamPredictionContext,
} from "./prediction-engine";

const ANALYSIS_COST = 3;

// Cache mémoire court : protège le quota API tout en conservant une fraîcheur
// adaptée aux matchs live, aux fixtures identifiés et aux requêtes manuelles.
type CacheEntry = { at: number; ttlMs: number; result: AnalysisResult };
const analysisCache = new Map<string, CacheEntry>();
const MANUAL_CACHE_TTL_MS = 10 * 60_000;
const FIXTURE_CACHE_TTL_MS = 5 * 60_000;
const LIVE_CACHE_TTL_MS = 45_000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function consumeAnalysisCredit(params: {
  userId: string;
  home: string;
  away: string;
  matchId?: string;
  result: AnalysisResult;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("consume_analysis_credit", {
    p_user_id: params.userId,
    p_cost: ANALYSIS_COST,
    p_home_team: params.home,
    p_away_team: params.away,
    p_match_id: params.matchId ?? null,
    p_result: params.result,
  });
  if (error) {
    if (error.message.includes("INSUFFICIENT_CREDITS")) {
      throw new Error(`CrÃ©dits insuffisants (${ANALYSIS_COST} requis).`);
    }
    console.error("Analysis credit transaction failed:", error.message);
    throw new Error("Impossible d'enregistrer le dÃ©bit de l'analyse.");
  }
  return data?.[0] ?? null;
}

const inputSchema = z.object({
  home: z.string().min(2).max(80),
  away: z.string().min(2).max(80),
  matchId: z.string().optional(),
});

const resultSchema = z.object({
  probabilities: z.object({
    home: z.number(),
    draw: z.number(),
    away: z.number(),
  }),
  probableScore: z.string(),
  markets: z
    .array(
      z.object({
        label: z.string(),
        pick: z.string(),
        confidence: z.number(),
        risk: z.enum(["bas", "moyen", "eleve"]),
        rationale: z.string(),
      }),
    )
    .min(4)
    .max(6),
  aiText: z.string(),
  keyFactors: z.array(z.string()).min(2).max(6).optional(),
});

export type AnalysisResult = z.infer<typeof resultSchema>;

const seasonYear = ((): number => {
  const d = new Date();
  const m = d.getUTCMonth() + 1;
  return m >= 7 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
})();

type TeamContext = TeamPredictionContext & {
  form: string[];
  formHome: string[];
  formAway: string[];
  rankInfo: string | null;
};

type HeadToHeadContext = H2HMatch & {
  date: string;
  home: string;
  away: string;
};

async function fetchTeamContext(teamName: string): Promise<TeamContext | null> {
  try {
    const { apiFootball } = await import("./apifootball.server");
    const teamsRaw = await apiFootball<
      Array<{ team: { id: number; name: string; country: string } }>
    >("/teams", { search: teamName.slice(0, 40) });
    const t = teamsRaw[0]?.team;
    if (!t) return null;

    // Forme récente : 10 derniers matchs pour séparer domicile / extérieur
    // Sources indépendantes en parallèle : l'algorithme et l'IA reçoivent le
    // même snapshot normalisé, jamais des données client ou des clés API.
    const [fixtures, injuries, standingsRaw] = await Promise.all([
      apiFootball<
        Array<{
          fixture: { date: string };
          league: { name: string };
          teams: { home: { id: number; name: string }; away: { id: number; name: string } };
          goals: { home: number | null; away: number | null };
        }>
      >("/fixtures", { team: t.id, last: 10 }).catch(() => []),
      apiFootball<Array<{ player: { name: string; reason: string } }>>("/injuries", {
        team: t.id,
        season: seasonYear,
      }).catch(() => []),
      apiFootball<
        Array<{
          league: {
            standings: Array<
              Array<{
                team: { id: number };
                rank: number;
                points: number;
                goalsDiff: number;
                form: string;
              }>
            >;
          };
        }>
      >("/standings", { team: t.id, season: seasonYear }).catch(() => []),
    ]);

    const formAll: string[] = [];
    const formHome: string[] = [];
    const formAway: string[] = [];
    const recent: TeamPredictionContext["recent"] = [];

    for (const f of fixtures) {
      const isHome = f.teams.home.id === t.id;
      const gf = isHome ? f.goals.home : f.goals.away;
      const ga = isHome ? f.goals.away : f.goals.home;
      let r = "?";
      if (gf !== null && ga !== null) r = gf > ga ? "V" : gf === ga ? "N" : "D";
      const opp = isHome ? f.teams.away.name : f.teams.home.name;
      const entry = `${r} ${gf ?? "-"}-${ga ?? "-"} vs ${opp}`;
      formAll.push(entry);
      if (isHome) formHome.push(entry);
      else formAway.push(entry);
      recent.push({
        isHome,
        goalsFor: gf,
        goalsAgainst: ga,
        result: r === "V" ? "W" : r === "N" ? "D" : r === "D" ? "L" : "?",
      });
    }

    // Blessures (saison en cours)
    const injuryNames = injuries.slice(0, 6).map((i) => `${i.player.name} (${i.player.reason})`);

    // Classement (pour évaluer la qualité de l'équipe dans sa ligue)
    const standing = standingsRaw
      .flatMap((row) => row.league.standings.flat())
      .find((row) => row.team.id === t.id);
    const rankInfo = standing
      ? `Rang ${standing.rank} · ${standing.points} pts · diff buts ${standing.goalsDiff > 0 ? "+" : ""}${standing.goalsDiff} · forme officielle ${standing.form}`
      : null;

    return {
      id: t.id,
      name: t.name,
      form: formAll.slice(0, 5),
      formHome: formHome.slice(0, 5),
      formAway: formAway.slice(0, 5),
      recent,
      injuries: injuryNames,
      rank: standing?.rank ?? null,
      points: standing?.points ?? null,
      goalsDiff: standing?.goalsDiff ?? null,
      rankInfo,
    };
  } catch {
    return null;
  }
}

async function fetchHeadToHead(homeId: number, awayId: number): Promise<HeadToHeadContext[]> {
  try {
    const { apiFootball } = await import("./apifootball.server");
    const raw = await apiFootball<
      Array<{
        fixture: { date: string };
        league: { name: string };
        teams: { home: { name: string }; away: { name: string } };
        goals: { home: number | null; away: number | null };
      }>
    >("/fixtures/headtohead", { h2h: `${homeId}-${awayId}`, last: 5 });
    return raw.map((f) => ({
      date: new Date(f.fixture.date).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      }),
      home: f.teams.home.name,
      away: f.teams.away.name,
      homeGoals: f.goals.home,
      awayGoals: f.goals.away,
    }));
  } catch {
    return [];
  }
}

/** Agrégation des votes communautaires publics pour un fixture connu. */
async function fetchCommunitySnapshot(fixtureId?: string): Promise<CommunitySnapshot | null> {
  const id = Number(fixtureId);
  if (!Number.isInteger(id) || id <= 0) return null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("community_predictions")
      .select("prediction")
      .eq("fixture_id", id)
      .limit(500);
    const counts = { home: 0, draw: 0, away: 0 };
    for (const row of (data ?? []) as Array<{ prediction?: string }>) {
      if (row.prediction === "home" || row.prediction === "draw" || row.prediction === "away") {
        counts[row.prediction] += 1;
      }
    }
    const votes = counts.home + counts.draw + counts.away;
    return votes ? { ...counts, votes } : null;
  } catch {
    // La migration peut ne pas être encore déployée : le moteur continue sans ce signal.
    return null;
  }
}

/**
 * Récupère les cotes bookmakers en temps réel pour le prochain match entre
 * les deux équipes (ou le match en cours).
 * Retourne une chaîne formatée pour injection dans le prompt IA, ou null si
 * aucune cote n'est disponible (match non répertorié ou quota API-Football atteint).
 */
async function fetchBookmakerOdds(
  homeId: number,
  awayId: number,
  requestedFixtureId?: number,
): Promise<OddsSnapshot | null> {
  try {
    const { apiFootball } = await import("./apifootball.server");

    // 1. Chercher le prochain fixture entre ces deux équipes
    const upcoming = await apiFootball<
      Array<{
        fixture: { id: number; date: string; status: { short: string } };
        teams: { home: { id: number }; away: { id: number } };
      }>
    >("/fixtures", { team: homeId, next: 10 }).catch(() => []);

    const match = upcoming.find(
      (f) =>
        (f.teams.home.id === homeId && f.teams.away.id === awayId) ||
        (f.teams.home.id === awayId && f.teams.away.id === homeId),
    );

    // Si aucun prochain match trouvé, essayer le dernier match (pour tester avec données historiques)
    let fixtureId: number | null = requestedFixtureId ?? match?.fixture?.id ?? null;
    if (!fixtureId) {
      const recent = await apiFootball<
        Array<{ fixture: { id: number }; teams: { home: { id: number }; away: { id: number } } }>
      >("/fixtures", { team: homeId, last: 10 }).catch(() => []);
      const found = recent.find(
        (f) =>
          (f.teams.home.id === homeId && f.teams.away.id === awayId) ||
          (f.teams.home.id === awayId && f.teams.away.id === homeId),
      );
      fixtureId = found?.fixture?.id ?? null;
    }

    if (!fixtureId) return null;

    // 2. Récupérer les cotes 1X2 (bet id = 1 : "Match Winner")
    const oddsRaw = await apiFootball<
      Array<{
        bookmakers: Array<{
          name: string;
          bets: Array<{
            name: string;
            values: Array<{ value: string; odd: string }>;
          }>;
        }>;
      }>
    >("/odds", { fixture: fixtureId, bet: 1 }).catch(() => []);

    if (!oddsRaw.length || !oddsRaw[0]?.bookmakers?.length) return null;

    // 3. Moyenner les cotes 1X2 sur tous les bookmakers disponibles
    const matchWinnerBets = oddsRaw[0].bookmakers.flatMap((b) =>
      b.bets.filter((bet) => bet.name === "Match Winner"),
    );

    const parse = (values: Array<{ value: string; odd: string }>, label: string) =>
      values
        .filter((v) => v.value === label)
        .map((v) => parseFloat(v.odd))
        .filter((n) => !isNaN(n) && n > 0);

    const homeOdds = matchWinnerBets.flatMap((b) => parse(b.values, "Home"));
    const drawOdds = matchWinnerBets.flatMap((b) => parse(b.values, "Draw"));
    const awayOdds = matchWinnerBets.flatMap((b) => parse(b.values, "Away"));

    if (!homeOdds.length && !drawOdds.length && !awayOdds.length) return null;

    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

    const spread = (arr: number[]) => {
      if (arr.length < 2) return 0;
      const mean = avg(arr) ?? 1;
      return Math.min(1, (Math.max(...arr) - Math.min(...arr)) / mean);
    };

    const n = Math.max(homeOdds.length, drawOdds.length, awayOdds.length);
    return {
      home: avg(homeOdds),
      draw: avg(drawOdds),
      away: avg(awayOdds),
      sources: n,
      fixtureId,
      marketSpread: Math.max(spread(homeOdds), spread(drawOdds), spread(awayOdds)),
    };
  } catch {
    return null;
  }
}

function numericStat(value: number | string | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(
    String(value ?? "")
      .replace("%", "")
      .trim(),
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Snapshot live dédié au match demandé. Il reste optionnel pour une analyse manuelle. */
async function fetchLiveSnapshot(matchId?: string): Promise<LiveSnapshot | null> {
  const fixtureId = Number(matchId);
  if (!Number.isInteger(fixtureId) || fixtureId <= 0) return null;
  try {
    const { apiFootball } = await import("./apifootball.server");
    const [fixtures, statistics, events, lineups] = await Promise.all([
      apiFootball<
        Array<{
          fixture: { status: { short: string; elapsed: number | null }; referee: string | null };
          league: { id: number; name: string };
          teams: { home: { id: number }; away: { id: number } };
          goals: { home: number | null; away: number | null };
        }>
      >("/fixtures", { id: fixtureId }).catch(() => []),
      apiFootball<
        Array<{
          team: { id: number };
          statistics: Array<{ type: string; value: number | string | null }>;
        }>
      >("/fixtures/statistics", { fixture: fixtureId }).catch(() => []),
      apiFootball<Array<{ team: { id: number }; type: string; detail: string }>>(
        "/fixtures/events",
        { fixture: fixtureId },
      ).catch(() => []),
      apiFootball<Array<{ team: { id: number }; startXI: unknown[] }>>("/fixtures/lineups", {
        fixture: fixtureId,
      }).catch(() => []),
    ]);
    const fixture = fixtures[0];
    if (!fixture) return null;
    const pick = (teamId: number, name: string) => {
      const value = statistics
        .find((row) => row.team.id === teamId)
        ?.statistics.find((stat) => stat.type.toLowerCase() === name.toLowerCase())?.value;
      return numericStat(value);
    };
    const homeRedCards = events.filter(
      (event) =>
        event.team.id === fixture.teams.home.id && /red/i.test(`${event.type} ${event.detail}`),
    ).length;
    const awayRedCards = events.filter(
      (event) =>
        event.team.id === fixture.teams.away.id && /red/i.test(`${event.type} ${event.detail}`),
    ).length;
    return {
      minute: fixture.fixture.status.elapsed,
      status: fixture.fixture.status.short,
      homeScore: fixture.goals.home ?? 0,
      awayScore: fixture.goals.away ?? 0,
      homeXg: pick(fixture.teams.home.id, "expected_goals"),
      awayXg: pick(fixture.teams.away.id, "expected_goals"),
      homeShotsOnTarget: pick(fixture.teams.home.id, "Shots on Goal"),
      awayShotsOnTarget: pick(fixture.teams.away.id, "Shots on Goal"),
      homeCorners: pick(fixture.teams.home.id, "Corner Kicks"),
      awayCorners: pick(fixture.teams.away.id, "Corner Kicks"),
      homeYellowCards: pick(fixture.teams.home.id, "Yellow Cards"),
      awayYellowCards: pick(fixture.teams.away.id, "Yellow Cards"),
      homeRedCards,
      awayRedCards,
      homeLineupConfirmed: Boolean(
        lineups.find((lineup) => lineup.team.id === fixture.teams.home.id)?.startXI.length,
      ),
      awayLineupConfirmed: Boolean(
        lineups.find((lineup) => lineup.team.id === fixture.teams.away.id)?.startXI.length,
      ),
      referee: fixture.fixture.referee,
      competitionId: fixture.league.id,
      competitionName: fixture.league.name,
    };
  } catch {
    return null;
  }
}

/**
 * Routeur IA hybride — fournisseur principal puis relais sécurisé.
 * Les clés sont lues via getConfig() : env var Cloudflare Worker en prod, table app_config Supabase en fallback.
 * Bascule silencieusement sans que l'utilisateur le sache.
 */
async function callSmartAIRouter(
  systemPrompt: string,
  userPrompt: string,
): Promise<AnalysisResult> {
  const { getConfig } = await import("./config.server");
  const [geminiKey, openRouterKey] = await Promise.all([
    getConfig("GEMINI_API_KEY"),
    getConfig("OPENROUTER_API_KEY"),
  ]);

  // 1. Fournisseur principal — quota et format JSON strict.
  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig: { response_mime_type: "application/json", temperature: 0.2 },
          }),
        },
      );

      if (res.ok) {
        const json = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return resultSchema.parse(JSON.parse(text));
      }

      // Quota dépassé → on tente le prochain provider
      const status = res.status;
      if (status !== 429 && status !== 503) {
        const body = await res.text().catch(() => "");
        console.warn(`Provider principal HTTP ${status}:`, body.slice(0, 200));
      }
    } catch (err) {
      console.warn("Provider principal indisponible:", err instanceof Error ? err.message : err);
    }
  }

  // 2. Relais OpenRouter — modèle gratuit de secours.
  if (openRouterKey) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://www.livefoot.fun",
          "X-Title": "Livefoot IA",
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-r1:free",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.2,
        }),
      });

      if (res.ok) {
        const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const text = json.choices?.[0]?.message?.content;
        if (text) return resultSchema.parse(JSON.parse(text));
      }

      // Quota OpenRouter dépassé → 3e tentative avec un modèle alternatif gratuit
      const resAlt = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://www.livefoot.fun",
          "X-Title": "Livefoot IA",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.3-70b-instruct:free",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.2,
        }),
      });

      if (resAlt.ok) {
        const json = (await resAlt.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = json.choices?.[0]?.message?.content;
        if (text) return resultSchema.parse(JSON.parse(text));
      }
    } catch (err) {
      console.warn("OpenRouter failover:", err instanceof Error ? err.message : err);
    }
  }

  throw new Error(
    "L'analyse IA est momentanément indisponible. Veuillez réessayer dans un instant.",
  );
}

export const runAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }): Promise<AnalysisResult> => {
    // 0. Cache-hit ?
    const cacheKey = `${data.home.toLowerCase().trim()}::${data.away.toLowerCase().trim()}::${data.matchId ?? ""}`;

    // 1. Crédits + profil.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("credits, plan")
      .eq("id", context.userId)
      .maybeSingle();
    if (profErr) throw new Error("Impossible de lire votre profil.");
    if (!profile) throw new Error("Profil introuvable.");
    if (profile.credits < ANALYSIS_COST) {
      throw new Error(
        `Crédits insuffisants (${ANALYSIS_COST} requis, ${profile.credits} disponibles).`,
      );
    }

    const isPremium = profile.plan !== "free";
    const limits = isPremium ? { hour: 30, day: 100 } : { hour: 5, day: 15 };
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count: hourCount } = await supabaseAdmin
      .from("ai_analyses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("created_at", hourAgo);
    if ((hourCount ?? 0) >= limits.hour) {
      throw new Error(
        `Limite atteinte : ${limits.hour} analyses/heure (plan ${isPremium ? "premium" : "gratuit"}). Réessayez plus tard.`,
      );
    }

    const { count: dayCount } = await supabaseAdmin
      .from("ai_analyses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("created_at", dayAgo);
    if ((dayCount ?? 0) >= limits.day) {
      throw new Error(
        `Limite quotidienne atteinte : ${limits.day} analyses/24h (plan ${isPremium ? "premium" : "gratuit"}). Réessayez demain.`,
      );
    }

    // 2. Enrichissement parallèle : forme + H2H + blessures + cotes bookmakers.
    const cached = analysisCache.get(cacheKey);
    if (cached && Date.now() - cached.at < cached.ttlMs) {
      await consumeAnalysisCredit({
        userId: context.userId,
        home: data.home,
        away: data.away,
        matchId: data.matchId,
        result: cached.result,
      });
      return cached.result;
    }

    const [homeCtx, awayCtx, liveSnapshot] = await Promise.all([
      fetchTeamContext(data.home),
      fetchTeamContext(data.away),
      fetchLiveSnapshot(data.matchId),
    ]);

    // H2H + bookmaker odds en parallèle une fois les IDs connus
    const [h2h, bookmakerOdds, communitySnapshot] = await Promise.all([
      homeCtx && awayCtx ? fetchHeadToHead(homeCtx.id, awayCtx.id) : Promise.resolve([]),
      homeCtx && awayCtx
        ? fetchBookmakerOdds(
            homeCtx.id,
            awayCtx.id,
            Number.isInteger(Number(data.matchId)) ? Number(data.matchId) : undefined,
          )
        : Promise.resolve(null),
      fetchCommunitySnapshot(data.matchId),
    ]);
    // Lors d'une saisie manuelle, les cotes permettent souvent d'identifier le
    // fixture : on complète alors le snapshot par statistiques et compositions.
    const analysisLiveSnapshot =
      liveSnapshot ??
      (bookmakerOdds?.fixtureId ? await fetchLiveSnapshot(String(bookmakerOdds.fixtureId)) : null);

    const h2hForPrompt = h2h
      .map(
        (match) =>
          `${match.date}: ${match.home} ${match.homeGoals ?? "-"}-${match.awayGoals ?? "-"} ${match.away}`,
      )
      .join("\n");
    const oddsForPrompt = bookmakerOdds
      ? `Cotes moyennes (${bookmakerOdds.sources} source(s)) : domicile ${bookmakerOdds.home?.toFixed(2) ?? "n/d"} · nul ${bookmakerOdds.draw?.toFixed(2) ?? "n/d"} · extérieur ${bookmakerOdds.away?.toFixed(2) ?? "n/d"}.`
      : "Aucune cote exploitable dans le snapshot.";
    const liveForPrompt = analysisLiveSnapshot
      ? `## Données live / match identifié\nStatut ${analysisLiveSnapshot.status}, minute ${analysisLiveSnapshot.minute ?? "n/d"}, score ${analysisLiveSnapshot.homeScore}-${analysisLiveSnapshot.awayScore}, xG ${analysisLiveSnapshot.homeXg}-${analysisLiveSnapshot.awayXg}, tirs cadrés ${analysisLiveSnapshot.homeShotsOnTarget}-${analysisLiveSnapshot.awayShotsOnTarget}, rouges ${analysisLiveSnapshot.homeRedCards}-${analysisLiveSnapshot.awayRedCards}, corners ${analysisLiveSnapshot.homeCorners ?? "n/d"}-${analysisLiveSnapshot.awayCorners ?? "n/d"}, cartons jaunes ${analysisLiveSnapshot.homeYellowCards ?? "n/d"}-${analysisLiveSnapshot.awayYellowCards ?? "n/d"}, compositions ${analysisLiveSnapshot.homeLineupConfirmed && analysisLiveSnapshot.awayLineupConfirmed ? "confirmées" : "non confirmées"}.`
      : "## Données live\nAucun snapshot live associé à cette demande.";

    const majorCompetitions = new Set([2, 39, 61, 78, 135, 140]);
    const competitionId = analysisLiveSnapshot?.competitionId ?? null;
    const competitionImportance =
      competitionId === null ? 0 : majorCompetitions.has(competitionId) ? 1 : 0.55;
    const coverage =
      [homeCtx, awayCtx, h2h.length >= 3, bookmakerOdds, analysisLiveSnapshot].filter(Boolean)
        .length / 5;
    const signals: MatchSignals = {
      community: communitySnapshot,
      competition: analysisLiveSnapshot
        ? {
            id: competitionId,
            name: analysisLiveSnapshot.competitionName ?? null,
            importance: competitionImportance,
          }
        : null,
      referee: analysisLiveSnapshot?.referee ? { name: analysisLiveSnapshot.referee } : null,
      market: bookmakerOdds
        ? {
            anomalyScore: bookmakerOdds.marketSpread && bookmakerOdds.marketSpread > 0.18 ? 0.5 : 0,
            volumeAvailable: false,
          }
        : null,
      coverage,
    };

    const signalBlock = [
      communitySnapshot
        ? `## Consensus communautaire\nVotes : domicile ${communitySnapshot.home}, nul ${communitySnapshot.draw}, extérieur ${communitySnapshot.away} sur ${communitySnapshot.votes} vote(s). Ce signal est secondaire et ne constitue pas une preuve.`
        : "## Consensus communautaire\nAucun vote public exploitable pour ce fixture.",
      analysisLiveSnapshot?.referee
        ? `## Compétition et arbitrage\nCompétition : ${analysisLiveSnapshot.competitionName ?? "n/d"}. Arbitre déclaré : ${analysisLiveSnapshot.referee}. Les habitudes historiques de l'arbitre ne sont pas disponibles dans le snapshot courant.`
        : "## Compétition et arbitrage\nArbitre ou compétition détaillée indisponible.",
      `## Couverture des données\nScore interne de couverture : ${Math.round(coverage * 100)}%. Les signaux absents ne doivent pas être inventés.`,
    ].join("\n\n");

    const contextBlock = [
      homeCtx
        ? [
            `## ${homeCtx.name} (domicile)`,
            homeCtx.rankInfo ? `Classement : ${homeCtx.rankInfo}` : null,
            `Forme globale (5 derniers) : ${homeCtx.form.join(" | ") || "n/d"}`,
            `Forme à DOMICILE (5 derniers) : ${homeCtx.formHome.join(" | ") || "n/d"}`,
            `Blessures/absents : ${homeCtx.injuries.join(", ") || "aucune donnée"}`,
          ]
            .filter(Boolean)
            .join("\n")
        : `## ${data.home} (domicile)\nAucune donnée statistique disponible.`,
      awayCtx
        ? [
            `## ${awayCtx.name} (extérieur)`,
            awayCtx.rankInfo ? `Classement : ${awayCtx.rankInfo}` : null,
            `Forme globale (5 derniers) : ${awayCtx.form.join(" | ") || "n/d"}`,
            `Forme à l'EXTÉRIEUR (5 derniers) : ${awayCtx.formAway.join(" | ") || "n/d"}`,
            `Blessures/absents : ${awayCtx.injuries.join(", ") || "aucune donnée"}`,
          ]
            .filter(Boolean)
            .join("\n")
        : `## ${data.away} (extérieur)\nAucune donnée statistique disponible.`,
      h2h.length
        ? `## Confrontations directes récentes\n${h2hForPrompt}`
        : `## Confrontations directes\nAucune donnée récente.`,
      // Section bookmakers — présente seulement si les cotes sont disponibles
      bookmakerOdds
        ? `## Consensus du marché (bookmakers)\n${oddsForPrompt}\nLes probabilités implicites incluent une marge : elles calibrent le modèle sans le remplacer.`
        : `## Consensus du marché\nAucune cote disponible pour ce match (match non répertorié ou hors calendrier).`,
      liveForPrompt,
      signalBlock,
    ].join("\n\n");

    // Le calcul déterministe est produit avant l'IA. Il constitue le fallback
    // immédiat et fournit à l'IA une base chiffrée qu'elle peut affiner.
    const basePrediction = buildStatisticalPrediction({
      home: homeCtx,
      away: awayCtx,
      h2h,
      odds: bookmakerOdds,
      live: analysisLiveSnapshot,
      signals,
    });
    const snapshotForAI = {
      home: homeCtx && {
        name: homeCtx.name,
        rank: homeCtx.rank,
        points: homeCtx.points,
        goalsDiff: homeCtx.goalsDiff,
        recent: homeCtx.recent,
        injuries: homeCtx.injuries,
      },
      away: awayCtx && {
        name: awayCtx.name,
        rank: awayCtx.rank,
        points: awayCtx.points,
        goalsDiff: awayCtx.goalsDiff,
        recent: awayCtx.recent,
        injuries: awayCtx.injuries,
      },
      h2h,
      odds: bookmakerOdds,
      live: analysisLiveSnapshot,
      signals,
      statisticalProjection: basePrediction,
    };

    const systemPrompt =
      "Tu es l'analyste statistique football de LiveFoot. Réponds uniquement en français et uniquement avec un objet JSON valide, sans markdown, sans préambule et sans nom de fournisseur ou de modèle.\n" +
      "Règle absolue : utilise exclusivement les données présentes dans le contexte. N'invente jamais un classement, une blessure, un résultat, une cote ou une source. Si une donnée manque, écris clairement qu'elle est indisponible et baisse la confiance.\n" +
      "Méthode : croise séparément la force globale, la forme récente, la forme à domicile de l'équipe qui reçoit, la forme à l'extérieur de l'équipe visiteuse, les absences, les confrontations directes et le marché. Donne davantage de poids aux données récentes et comparables, sans surinterpréter un échantillon court.\n" +
      "Calibration : lorsque des cotes sont disponibles, convertis-les en probabilités implicites, tiens compte de la marge et utilise-les comme ancre de marché. Explique tout écart important dans aiText. Sans cotes, ne prétends pas qu'il existe un consensus.\n" +
      "Probabilités : home, draw et away sont des nombres entiers compris entre 0 et 100 et leur somme doit être exactement 100. Le score probable doit rester plausible et cohérent avec le niveau de buts attendu.\n" +
      "Marchés : retourne 5 objets maximum couvrant 1X2 ou Double Chance, BTTS, Over/Under 2.5 et, seulement si les données le permettent, corners ou cartons. Une recommandation n'est jamais une garantie de gain.\n" +
      "Confiance : nombre entre 0 et 85. Risque : exactement bas, moyen ou eleve. La confiance baisse si les équipes sont mal identifiées, si l'historique est faible ou si des données clés manquent.\n" +
      "aiText : 3 à 4 phrases utiles et nuancées. keyFactors : 3 à 5 phrases courtes, chacune reliée à un fait fourni. N'affiche jamais de nom de modèle, de fournisseur, de clé technique ou de promesse de gain.\n" +
      "Les scores internes de couverture, d'anomalie de marché et de volume sont des signaux de calibration uniquement : ne les présente jamais comme une preuve de match truqué, ne les affiche pas dans aiText ou keyFactors et n'invente aucune information absente.\n" +
      "Une projection statistique déterministe est incluse dans le snapshot. Tu peux l'affiner avec les données fournies, mais n'écarte pas fortement ses probabilités sans fait précis ; tu ne dois jamais créer de donnée absente.";

    const userPrompt =
      `Analyse la rencontre ${data.home} vs ${data.away}.\n\n` +
      `Données à utiliser :\n${contextBlock}\n\n` +
      `Snapshot structuré complet (source de vérité) :\n${JSON.stringify(snapshotForAI)}\n\n` +
      `Produis l'analyse structurée demandée au format JSON avec les champs: probabilities (home, draw, away), probableScore, markets (array de objets), aiText, keyFactors (array).`;

    // 3. Routeur hybride : l'IA améliore le calcul si elle répond à temps ; le
    // moteur statistique conserve seul la continuité de service en cas d'échec.
    let enriched: StatisticalPrediction | null = null;
    try {
      const aiResult = await withTimeout(
        callSmartAIRouter(systemPrompt, userPrompt),
        7_000,
        "Le délai d'enrichissement IA est dépassé.",
      );
      enriched = { ...aiResult, keyFactors: aiResult.keyFactors ?? [] };
    } catch (error) {
      console.warn(
        "AI enrichment unavailable; serving deterministic prediction:",
        error instanceof Error ? error.message : error,
      );
    }
    const result = resultSchema.parse(blendPredictions(basePrediction, enriched));

    // 4. Débit + log.
    await consumeAnalysisCredit({
      userId: context.userId,
      home: data.home,
      away: data.away,
      matchId: data.matchId,
      result,
    });

    // 5. Cache.
    const cacheTtlMs = analysisLiveSnapshot?.minute
      ? LIVE_CACHE_TTL_MS
      : data.matchId
        ? FIXTURE_CACHE_TTL_MS
        : MANUAL_CACHE_TTL_MS;
    analysisCache.set(cacheKey, { at: Date.now(), ttlMs: cacheTtlMs, result });

    return result;
  });

export const getMyBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("credits, plan, display_name, avatar_url, premium_until")
      .eq("id", context.userId)
      .maybeSingle();
    return (
      data ?? {
        credits: 0,
        plan: "free" as const,
        display_name: null,
        avatar_url: null,
        premium_until: null,
      }
    );
  });

export const getMyAnalysisHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("credits_ledger")
      .select("id, kind, amount, balance_after, label, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return data ?? [];
  });
