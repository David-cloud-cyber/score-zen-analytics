import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateObject, NoObjectGeneratedError } from "ai";

const ANALYSIS_COST = 2;

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
});

export type AnalysisResult = z.infer<typeof resultSchema>;

export const runAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }): Promise<AnalysisResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Lovable AI Gateway indisponible.");

    // 1. Verify + debit credits atomically (RLS as user, but we need admin for the ledger insert).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("credits")
      .eq("id", context.userId)
      .maybeSingle();
    if (profErr) throw new Error("Impossible de lire votre profil.");
    if (!profile) throw new Error("Profil introuvable.");
    if (profile.credits < ANALYSIS_COST) {
      throw new Error(`Crédits insuffisants (${ANALYSIS_COST} requis, ${profile.credits} disponibles).`);
    }

    // 2. Call the AI
    const { createLovableAI } = await import("./ai-gateway.server");
    const gateway = createLovableAI(apiKey);
    const model = gateway("google/gemini-2.5-flash");

    let result: AnalysisResult;
    try {
      const { object } = await generateObject({
        model,
        schema: resultSchema,
        system:
          "Tu es un analyste football expert. Tu réponds UNIQUEMENT en français. " +
          "Fournis des probabilités réalistes qui somment à 100 (chiffres entiers). " +
          "Reste factuel, prudent, et n'incite jamais aux paris. " +
          "Les marchés doivent couvrir : 1X2, BTTS, Over/Under 2.5, Double Chance, Corners ou Cartons.",
        prompt: `Analyse la rencontre ${data.home} vs ${data.away}. ` +
          `Estime probabilités 1X2, score probable, 5 marchés recommandés avec niveau de confiance (0-100) et risque (bas/moyen/eleve), ` +
          `et un texte d'analyse de 3-4 phrases (aiText) synthétisant la forme et les enjeux.`,
      });
      result = object;
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err)) {
        throw new Error("L'IA n'a pas pu produire d'analyse structurée. Réessayez.");
      }
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429")) throw new Error("Trop de requêtes vers l'IA. Réessayez dans un instant.");
      if (msg.includes("402")) throw new Error("Crédits AI Gateway épuisés. Contactez le support.");
      throw err;
    }

    // 3. Debit + log
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
