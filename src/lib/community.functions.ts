import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CommunityVoteOption = "home" | "draw" | "away";

export type MatchCommunityVotes = {
  fixtureId: number;
  counts: Record<CommunityVoteOption, number>;
  total: number;
};

async function readMatchVotes(fixtureId: number): Promise<MatchCommunityVotes> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("community_predictions")
    .select("prediction")
    .eq("fixture_id", fixtureId)
    .limit(5000);

  if (error) throw new Error("Impossible de charger les votes de la communauté.");

  const counts: Record<CommunityVoteOption, number> = { home: 0, draw: 0, away: 0 };
  for (const row of data ?? []) {
    if (row.prediction in counts) counts[row.prediction as CommunityVoteOption] += 1;
  }

  return { fixtureId, counts, total: counts.home + counts.draw + counts.away };
}

export const getMatchCommunityVotes = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ fixtureId: z.number().int().positive() }).parse(input))
  .handler(({ data }) => readMatchVotes(data.fixtureId));

export const castMatchCommunityVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        fixtureId: z.number().int().positive(),
        homeTeam: z.string().min(1).max(120),
        awayTeam: z.string().min(1).max(120),
        prediction: z.enum(["home", "draw", "away"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("community_predictions").upsert(
      {
        user_id: context.userId,
        user_name: "Membre LiveFoot",
        fixture_id: data.fixtureId,
        home_team: data.homeTeam,
        away_team: data.awayTeam,
        prediction: data.prediction,
      },
      { onConflict: "user_id,fixture_id" },
    );

    if (error) throw new Error("Impossible d'enregistrer votre vote.");
    return readMatchVotes(data.fixtureId);
  });
