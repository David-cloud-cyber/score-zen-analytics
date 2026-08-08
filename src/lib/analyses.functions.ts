import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateObject } from "ai";

const ANALYSIS_COST = 3;

// Cache mémoire des analyses (30 min) — protège le quota API-Football + AI Gateway
// quand plusieurs utilisateurs demandent la même paire d'équipes.
type CacheEntry = { at: number; result: AnalysisResult };
const analysisCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60_000;

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

// Normalise et corrige les probabilités pour toujours sommer à 100.
function normalizeProbabilities(p: { home: number; draw: number; away: number }) {
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  let home = clamp(p.home);
  let draw = clamp(p.draw);
  let away = clamp(p.away);
  const sum = home + draw + away;
  if (sum === 0) return { home: 34, draw: 33, away: 33 };
  if (sum !== 100) {
    home = Math.round((home / sum) * 100);
    draw = Math.round((draw / sum) * 100);
    away = 100 - home - draw;
    if (away < 0) { away = 0; draw = 100 - home; }
  }
  return { home, draw, away };
}

const seasonYear = ((): number => {
  const d = new Date();
  const m = d.getUTCMonth() + 1;
  return m >= 7 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
})();

async function fetchTeamContext(teamName: string) {
  try {
    const { apiFootball } = await import("./apifootball.server");
    const teamsRaw = await apiFootball<Array<{ team: { id: number; name: string; country: string } }>>(
      "/teams",
      { search: teamName.slice(0, 40) },
    );
    const t = teamsRaw[0]?.team;
    if (!t) return null;

    // Forme récente : 10 derniers matchs pour séparer domicile / extérieur
    const fixtures = await apiFootball<
      Array<{
        fixture: { date: string };
        league: { name: string };
        teams: { home: { id: number; name: string }; away: { id: number; name: string } };
        goals: { home: number | null; away: number | null };
      }>
    >("/fixtures", { team: t.id, last: 10 }).catch(() => []);

    const formAll: string[] = [];
    const formHome: string[] = [];
    const formAway: string[] = [];

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
    }

    // Blessures (saison en cours)
    const injuries = await apiFootball<
      Array<{ player: { name: string; reason: string } }>
    >("/injuries", { team: t.id, season: seasonYear }).catch(() => []);
    const injuryNames = injuries.slice(0, 6).map((i) => `${i.player.name} (${i.player.reason})`);

    // Classement (pour évaluer la qualité de l'équipe dans sa ligue)
    const standingsRaw = await apiFootball<
      Array<{ league: { standings: Array<Array<{ rank: number; points: number; goalsDiff: number; form: string }>> } }>
    >("/standings", { team: t.id, season: seasonYear }).catch(() => []);
    const standing = standingsRaw[0]?.league?.standings?.[0]?.[0];
    const rankInfo = standing
      ? `Rang ${standing.rank} · ${standing.points} pts · diff buts ${standing.goalsDiff > 0 ? "+" : ""}${standing.goalsDiff} · forme officielle ${standing.form}`
      : null;

    return {
      id: t.id,
      name: t.name,
      form: formAll.slice(0, 5),
      formHome: formHome.slice(0, 5),
      formAway: formAway.slice(0, 5),
      injuries: injuryNames,
      rankInfo,
    };
  } catch {
    return null;
  }
}

async function fetchHeadToHead(homeId: number, awayId: number) {
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
    return raw.map((f) => {
      const d = new Date(f.fixture.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
      return `${d}: ${f.teams.home.name} ${f.goals.home ?? "-"}-${f.goals.away ?? "-"} ${f.teams.away.name}`;
    });
  } catch {
    return [];
  }
}

/**
 * Récupère les cotes bookmakers en temps réel pour le prochain match entre
 * les deux équipes (ou le match en cours).
 * Retourne une chaîne formatée pour injection dans le prompt IA, ou null si
 * aucune cote n'est disponible (match non répertorié ou quota API-Football atteint).
 */
async function fetchBookmakerOdds(homeId: number, awayId: number): Promise<string | null> {
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
    let fixtureId: number | null = match?.fixture?.id ?? null;
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
      values.filter((v) => v.value === label).map((v) => parseFloat(v.odd)).filter((n) => !isNaN(n) && n > 0);

    const homeOdds = matchWinnerBets.flatMap((b) => parse(b.values, "Home"));
    const drawOdds = matchWinnerBets.flatMap((b) => parse(b.values, "Draw"));
    const awayOdds = matchWinnerBets.flatMap((b) => parse(b.values, "Away"));

    if (!homeOdds.length && !drawOdds.length && !awayOdds.length) return null;

    const avg = (arr: number[]) =>
      arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : "n/d";

    // Convertir les cotes décimales en probabilités implicites (%)
    const impliedProb = (odds: number[]) => {
      if (!odds.length) return "n/d";
      const avgOdd = odds.reduce((a, b) => a + b, 0) / odds.length;
      return `${Math.round((1 / avgOdd) * 100)}%`;
    };

    const n = Math.max(homeOdds.length, drawOdds.length, awayOdds.length);
    return (
      `Cotes moyennes bookmakers (${n} source${n > 1 ? "s" : ""}) : ` +
      `Domicile ${avg(homeOdds)} (${impliedProb(homeOdds)}) · ` +
      `Nul ${avg(drawOdds)} (${impliedProb(drawOdds)}) · ` +
      `Extérieur ${avg(awayOdds)} (${impliedProb(awayOdds)})`
    );
  } catch {
    return null;
  }
}

/**
 * Routeur IA Hybride — priorité Gemini 2.5 Flash (Google AI Studio) puis DeepSeek R1 (OpenRouter).
 * Les clés sont lues via getConfig() : env var Cloudflare Worker en prod, table app_config Supabase en fallback.
 * Bascule silencieusement sans que l'utilisateur le sache.
 */
async function callSmartAIRouter(systemPrompt: string, userPrompt: string): Promise<AnalysisResult> {
  const { getConfig } = await import("./config.server");
  const [geminiKey, openRouterKey] = await Promise.all([
    getConfig("GEMINI_API_KEY"),
    getConfig("OPENROUTER_API_KEY"),
  ]);

  // 1. Google AI Studio — Gemini 2.5 Flash (quota gratuit : 15 req/min, 1 M tokens/jour)
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
        const json = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return resultSchema.parse(JSON.parse(text));
      }

      // Quota dépassé → on tente le prochain provider
      const status = res.status;
      if (status !== 429 && status !== 503) {
        const body = await res.text().catch(() => "");
        console.warn(`Gemini 2.5 Flash HTTP ${status}:`, body.slice(0, 200));
      }
    } catch (err) {
      console.warn("Gemini 2.5 Flash failover:", err instanceof Error ? err.message : err);
    }
  }

  // 2. OpenRouter — DeepSeek R1 :free (raisonnement puissant, quota ~200 req/jour)
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
        const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
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
        const json = await resAlt.json() as { choices?: Array<{ message?: { content?: string } }> };
        const text = json.choices?.[0]?.message?.content;
        if (text) return resultSchema.parse(JSON.parse(text));
      }
    } catch (err) {
      console.warn("OpenRouter failover:", err instanceof Error ? err.message : err);
    }
  }

  throw new Error("L'analyse IA est momentanément indisponible. Veuillez réessayer dans un instant.");
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
      throw new Error(`Crédits insuffisants (${ANALYSIS_COST} requis, ${profile.credits} disponibles).`);
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
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      await consumeAnalysisCredit({
        userId: context.userId,
        home: data.home,
        away: data.away,
        matchId: data.matchId,
        result: cached.result,
      });
      return cached.result;
    }

    const [homeCtx, awayCtx] = await Promise.all([
      fetchTeamContext(data.home),
      fetchTeamContext(data.away),
    ]);

    // H2H + bookmaker odds en parallèle une fois les IDs connus
    const [h2h, bookmakerOdds] = await Promise.all([
      homeCtx && awayCtx ? fetchHeadToHead(homeCtx.id, awayCtx.id) : Promise.resolve([]),
      homeCtx && awayCtx ? fetchBookmakerOdds(homeCtx.id, awayCtx.id) : Promise.resolve(null),
    ]);

    const contextBlock = [
      homeCtx
        ? [
            `## ${homeCtx.name} (domicile)`,
            homeCtx.rankInfo ? `Classement : ${homeCtx.rankInfo}` : null,
            `Forme globale (5 derniers) : ${homeCtx.form.join(" | ") || "n/d"}`,
            `Forme à DOMICILE (5 derniers) : ${homeCtx.formHome.join(" | ") || "n/d"}`,
            `Blessures/absents : ${homeCtx.injuries.join(", ") || "aucune donnée"}`,
          ].filter(Boolean).join("\n")
        : `## ${data.home} (domicile)\nAucune donnée statistique disponible.`,
      awayCtx
        ? [
            `## ${awayCtx.name} (extérieur)`,
            awayCtx.rankInfo ? `Classement : ${awayCtx.rankInfo}` : null,
            `Forme globale (5 derniers) : ${awayCtx.form.join(" | ") || "n/d"}`,
            `Forme à l'EXTÉRIEUR (5 derniers) : ${awayCtx.formAway.join(" | ") || "n/d"}`,
            `Blessures/absents : ${awayCtx.injuries.join(", ") || "aucune donnée"}`,
          ].filter(Boolean).join("\n")
        : `## ${data.away} (extérieur)\nAucune donnée statistique disponible.`,
      h2h.length ? `## Confrontations directes récentes\n${h2h.join("\n")}` : `## Confrontations directes\nAucune donnée récente.`,
      // Section bookmakers — présente seulement si les cotes sont disponibles
      bookmakerOdds
        ? `## Consensus du marché (bookmakers en temps réel)\n${bookmakerOdds}\nNote : les probabilités implicites incluent la marge bookmaker (~5-8%). Pour l'analyse pure, retraite cette marge.`
        : `## Consensus du marché\nAucune cote disponible pour ce match (match non répertorié ou hors calendrier).`,
    ].join("\n\n");

    const systemPrompt =
      "Tu es un analyste football professionnel qui répond UNIQUEMENT en français sous format JSON strict.\n" +
      "Tu utilises EXCLUSIVEMENT les données factuelles fournies dans le contexte (classement, forme globale, forme domicile/extérieur séparée, blessures, confrontations directes, cotes bookmakers) — n'invente aucun résultat ni statistique.\n" +
      "IMPORTANT : différencie bien la forme à domicile (équipe qui reçoit) de la forme à l'extérieur (équipe visiteuse) — c'est un facteur déterminant.\n" +
      "IMPORTANT : si des cotes bookmakers sont fournies, utilise-les comme signal de calibration. Tes probabilités 1X2 doivent être cohérentes avec le consensus du marché sauf si les données statistiques justifient un écart. Mentionne l'alignement/écart avec le marché dans aiText.\n" +
      "Tu produis des probabilités 1X2 entières (0-100) qui SOMMENT EXACTEMENT à 100 et un score probable réaliste basé sur les données.\n" +
      "Tu proposes 5 marchés recommandés couvrant 1X2, Double Chance, BTTS, Over/Under 2.5, et un marché parmi Corners ou Cartons.\n" +
      "Confiance = 0-100 (jamais > 85 : garde toujours de l'humilité). Risque = bas | moyen | eleve.\n" +
      "aiText = 3-4 phrases synthétisant le classement, la forme récente domicile/extérieur, les absents clés, la dynamique du match et le positionnement par rapport aux cotes.\n" +
      "keyFactors = 3-5 puces courtes (facteurs déterminants les plus importants).\n" +
      "Reste factuel, prudent, ne pousse jamais aux paris.";

    const userPrompt =
      `Analyse la rencontre ${data.home} vs ${data.away}.\n\n` +
      `Données à utiliser :\n${contextBlock}\n\n` +
      `Produis l'analyse structurée demandée au format JSON avec les champs: probabilities (home, draw, away), probableScore, markets (array de objets), aiText, keyFactors (array).`;

    // 3. Execution du Routeur Hybride
    let result = await callSmartAIRouter(systemPrompt, userPrompt);

    // Normalisation post-hoc : garantir la somme à 100.
    result = { ...result, probabilities: normalizeProbabilities(result.probabilities) };

    // 4. Débit + log.
    await consumeAnalysisCredit({
      userId: context.userId,
      home: data.home,
      away: data.away,
      matchId: data.matchId,
      result,
    });

    // 5. Cache.
    analysisCache.set(cacheKey, { at: Date.now(), result });

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
    return data ?? { credits: 0, plan: "free" as const, display_name: null, avatar_url: null, premium_until: null };
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
