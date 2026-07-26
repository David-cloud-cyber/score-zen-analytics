import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateObject } from "ai";

const ANALYSIS_COST = 2;

// Cache mémoire des analyses (30 min) — protège le quota API-Football + AI Gateway
// quand plusieurs utilisateurs demandent la même paire d'équipes.
type CacheEntry = { at: number; result: AnalysisResult };
const analysisCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60_000;

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

async function fetchTeamContext(teamName: string) {
  try {
    const { apiFootball } = await import("./apifootball.server");
    const teamsRaw = await apiFootball<Array<{ team: { id: number; name: string; country: string } }>>(
      "/teams",
      { search: teamName.slice(0, 40) },
    );
    const t = teamsRaw[0]?.team;
    if (!t) return null;

    // Forme récente : 5 derniers matchs
    const fixtures = await apiFootball<
      Array<{
        fixture: { date: string };
        league: { name: string };
        teams: { home: { id: number; name: string }; away: { id: number; name: string } };
        goals: { home: number | null; away: number | null };
      }>
    >("/fixtures", { team: t.id, last: 5 }).catch(() => []);

    const form = fixtures.map((f) => {
      const isHome = f.teams.home.id === t.id;
      const gf = isHome ? f.goals.home : f.goals.away;
      const ga = isHome ? f.goals.away : f.goals.home;
      let r = "?";
      if (gf !== null && ga !== null) r = gf > ga ? "V" : gf === ga ? "N" : "D";
      const opp = isHome ? f.teams.away.name : f.teams.home.name;
      return `${r} ${gf ?? "-"}-${ga ?? "-"} vs ${opp}`;
    });

    // Blessures (saison en cours)
    const seasonYear = ((): number => {
      const d = new Date();
      const m = d.getUTCMonth() + 1;
      return m >= 7 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
    })();
    const injuries = await apiFootball<
      Array<{ player: { name: string; reason: string } }>
    >("/injuries", { team: t.id, season: seasonYear }).catch(() => []);
    const injuryNames = injuries.slice(0, 6).map((i) => `${i.player.name} (${i.player.reason})`);

    return { id: t.id, name: t.name, form, injuries: injuryNames };
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
 * Routeur d'IA Hybride (Google AI Studio -> OpenRouter -> Lovable Gateway)
 * Bascule automatiquement sans bloquer l'utilisateur en cas de rate-limit / quota dépassé.
 */
async function callSmartAIRouter(systemPrompt: string, userPrompt: string): Promise<AnalysisResult> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  // 1. Essayer Google AI Studio (Gemini 2.0 Flash) — Gratuit & Ultra Rapide
  if (geminiKey) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.2,
          },
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          return resultSchema.parse(parsed);
        }
      }
    } catch (err) {
      console.warn("Primary AI (Gemini Studio) failover notice:", err instanceof Error ? err.message : err);
    }
  }

  // 2. Fallback vers OpenRouter (DeepSeek R1 / Llama 3.3 70B)
  if (openRouterKey) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://www.livefoot.fun",
          "X-Title": "ScoreZen AI",
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

      if (res.ok) {
        const json = await res.json();
        const text = json.choices?.[0]?.message?.content;
        if (text) {
          const parsed = JSON.parse(text);
          return resultSchema.parse(parsed);
        }
      }
    } catch (err) {
      console.warn("Secondary AI (OpenRouter) failover notice:", err instanceof Error ? err.message : err);
    }
  }

  // 3. Secours ultime : Lovable AI Gateway
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (lovableKey) {
    const { createLovableAI } = await import("./ai-gateway.server");
    const gateway = createLovableAI(lovableKey);
    const model = gateway("google/gemini-3.1-pro-preview");
    const { object } = await generateObject({
      model,
      schema: resultSchema,
      system: systemPrompt,
      prompt: userPrompt,
    });
    return object;
  }

  throw new Error("L'analyse IA est momentanément indisponible. Veuillez réessayer dans un instant.");
}

export const runAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }): Promise<AnalysisResult> => {
    // 0. Cache-hit ?
    const cacheKey = `${data.home.toLowerCase().trim()}::${data.away.toLowerCase().trim()}`;
    const cached = analysisCache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return cached.result;
    }

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

    // 2. Enrichissement : forme + H2H + blessures via API-Football.
    const [homeCtx, awayCtx] = await Promise.all([
      fetchTeamContext(data.home),
      fetchTeamContext(data.away),
    ]);
    const h2h = homeCtx && awayCtx ? await fetchHeadToHead(homeCtx.id, awayCtx.id) : [];

    const contextBlock = [
      homeCtx
        ? `## ${homeCtx.name} (domicile)\nForme (5 derniers) : ${homeCtx.form.join(" | ") || "n/d"}\nBlessures/absents : ${homeCtx.injuries.join(", ") || "aucune donnée"}`
        : `## ${data.home} (domicile)\nAucune donnée statistique disponible.`,
      awayCtx
        ? `## ${awayCtx.name} (extérieur)\nForme (5 derniers) : ${awayCtx.form.join(" | ") || "n/d"}\nBlessures/absents : ${awayCtx.injuries.join(", ") || "aucune donnée"}`
        : `## ${data.away} (extérieur)\nAucune donnée statistique disponible.`,
      h2h.length ? `## Confrontations directes récentes\n${h2h.join("\n")}` : `## Confrontations directes\nAucune donnée récente.`,
    ].join("\n\n");

    const systemPrompt =
      "Tu es un analyste football professionnel qui répond UNIQUEMENT en français sous format JSON strict.\n" +
      "Tu utilises EXCLUSIVEMENT les données factuelles fournies dans le contexte (forme récente, blessures, confrontations directes) — n'invente aucun résultat ni statistique.\n" +
      "Tu produis des probabilités 1X2 entières (0-100) qui SOMMENT à 100 et un score probable réaliste.\n" +
      "Tu proposes 5 marchés recommandés couvrant 1X2, Double Chance, BTTS, Over/Under 2.5, et un marché parmi Corners ou Cartons.\n" +
      "Confiance = 0-100 (jamais > 85 : garde toujours de l'humilité). Risque = bas | moyen | eleve.\n" +
      "aiText = 3-4 phrases synthétisant la forme, les absents et la dynamique du match.\n" +
      "keyFactors = 3-5 puces courtes (facteurs déterminants).\n" +
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
    const newBalance = profile.credits - ANALYSIS_COST;
    await supabaseAdmin.from("profiles").update({ credits: newBalance }).eq("id", context.userId);
    await supabaseAdmin.from("credits_ledger").insert({
      user_id: context.userId,
      kind: "analysis",
      amount: -ANALYSIS_COST,
      balance_after: newBalance,
      label: `Analyse ${data.home} vs ${data.away}`,
    });
    await supabaseAdmin.from("ai_analyses").insert({
      user_id: context.userId,
      home_team: data.home,
      away_team: data.away,
      match_id: data.matchId ?? null,
      result: result as never,
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
      .select("credits, plan, display_name, avatar_url")
      .eq("id", context.userId)
      .maybeSingle();
    return data ?? { credits: 0, plan: "free" as const, display_name: null, avatar_url: null };
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
