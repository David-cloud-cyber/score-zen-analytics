import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getFixtures } from "@/lib/football.functions";
import type { RemoteMatchSummary } from "@/lib/football-types";
import { todayISO } from "@/lib/apifootball.server";

export type CommunityVoteOption = "home" | "draw" | "away";

export type MatchCommunityVotes = {
  fixtureId: number;
  counts: Record<CommunityVoteOption, number>;
  total: number;
};

export type CommunityMessage = {
  id: string;
  user_name: string;
  user_avatar: string | null;
  message: string;
  created_at: string;
  match_id: number | null;
};

export type CommunityPoll = {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  league: string;
  status: RemoteMatchSummary["status"];
  kickoff: string;
  timeLabel: string;
  minute: number | null;
  votes: Record<CommunityVoteOption, number>;
};

export type CommunityOverview = {
  polls: CommunityPoll[];
  messages: CommunityMessage[];
  leaderboard: Array<{ rank: number; name: string; wins: number; settled: number }>;
  updatedAt: string | null;
  state: "fresh" | "stale" | "unavailable";
};

const voteInput = z.object({
  fixtureId: z.number().int().positive(),
  homeTeam: z.string().trim().min(1).max(120),
  awayTeam: z.string().trim().min(1).max(120),
  prediction: z.enum(["home", "draw", "away"]),
});

const messageInput = z.object({
  message: z.string().trim().min(1).max(500),
  matchId: z.number().int().positive().nullable().optional(),
});

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("community-data-timeout")), milliseconds);
    }),
  ]);
}

async function getDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

function emptyCounts(): Record<CommunityVoteOption, number> {
  return { home: 0, draw: 0, away: 0 };
}

function readSafeMessage(row: any): CommunityMessage {
  return {
    id: String(row.id),
    user_name: String(row.user_name || "Membre LiveFoot").slice(0, 80),
    user_avatar: row.user_avatar ? String(row.user_avatar) : null,
    message: String(row.message || "").slice(0, 500),
    created_at: String(row.created_at),
    match_id: typeof row.match_id === "number" ? row.match_id : null,
  };
}

async function readMessages(limit = 50): Promise<CommunityMessage[]> {
  const db = await getDb();
  const { data, error } = await db
    .from("community_messages")
    .select("id, user_name, user_avatar, message, created_at, match_id")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error) throw new Error("Impossible de charger les messages pour le moment.");
  return (data ?? []).map(readSafeMessage).reverse();
}

async function readMatchVotes(fixtureId: number): Promise<MatchCommunityVotes> {
  const db = await getDb();
  const { data, error } = await db
    .from("community_predictions")
    .select("prediction")
    .eq("fixture_id", fixtureId)
    .limit(5000);

  if (error) throw new Error("Impossible de charger les votes pour le moment.");

  const counts = emptyCounts();
  for (const row of data ?? []) {
    if (row.prediction in counts) counts[row.prediction as CommunityVoteOption] += 1;
  }
  return { fixtureId, counts, total: counts.home + counts.draw + counts.away };
}

async function getRelevantMatches(): Promise<{
  matches: RemoteMatchSummary[];
  updatedAt: string | null;
  state: CommunityOverview["state"];
}> {
  const [dayResult, liveResult] = await Promise.allSettled([
    withTimeout(getFixtures({ data: { date: todayISO() } }), 4_500),
    withTimeout(getFixtures({ data: { live: true } }), 4_500),
  ]);
  const payloads = [
    dayResult.status === "fulfilled" ? dayResult.value : null,
    liveResult.status === "fulfilled" ? liveResult.value : null,
  ].filter(Boolean) as Awaited<ReturnType<typeof getFixtures>>[];
  const byId = new Map<number, RemoteMatchSummary>();
  for (const payload of payloads) {
    for (const match of payload.matches) byId.set(match.id, match);
  }
  const now = Date.now();
  const matches = [...byId.values()]
    .filter((match) => {
      if (match.status === "live" || match.status === "ht") return true;
      if (match.status !== "upcoming") return false;
      const kickoff = new Date(match.kickoff).getTime();
      return Number.isFinite(kickoff) && kickoff >= now && kickoff - now <= 6 * 60 * 60 * 1000;
    })
    .slice(0, 3);
  const fetchedAt = payloads
    .map((payload) => payload.fetchedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .pop() ?? null;
  const state = matches.length
    ? payloads.some((payload) => payload.state === "fresh")
      ? "fresh"
      : "stale"
    : payloads.length
      ? "unavailable"
      : "unavailable";
  return { matches, updatedAt: fetchedAt, state };
}

async function isRealCommunityFixture(fixtureId: number): Promise<RemoteMatchSummary | null> {
  const { matches } = await getRelevantMatches();
  return matches.find((match) => match.id === fixtureId) ?? null;
}

export const getCommunityMessages = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ limit: z.number().int().min(1).max(100).default(50) }).parse(input ?? {}))
  .handler(({ data }) => readMessages(data.limit));

export const getMyCommunityVotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ fixtureIds: z.array(z.number().int().positive()).max(20) }).parse(input))
  .handler(async ({ data, context }) => {
    if (!data.fixtureIds.length) return {} as Record<number, CommunityVoteOption>;
    const db = await getDb();
    const { data: rows, error } = await db
      .from("community_predictions")
      .select("fixture_id, prediction")
      .eq("user_id", context.userId)
      .in("fixture_id", data.fixtureIds);
    if (error) throw new Error("Impossible de restaurer vos votes pour le moment.");
    return (rows ?? []).reduce((result: Record<number, CommunityVoteOption>, row: any) => {
      if (row.prediction === "home" || row.prediction === "draw" || row.prediction === "away") {
        result[Number(row.fixture_id)] = row.prediction;
      }
      return result;
    }, {});
  });

export const getCommunityOverview = createServerFn({ method: "GET" }).handler(
  async (): Promise<CommunityOverview> => {
    const [{ matches, updatedAt, state }, messagesResult] = await Promise.all([
      getRelevantMatches().catch(() => ({ matches: [], updatedAt: null, state: "unavailable" as const })),
      readMessages().catch(() => []),
    ]);
    const db = await getDb();
    const fixtureIds = matches.map((match) => match.id);
    const { data: votes } = fixtureIds.length
      ? await db
          .from("community_predictions")
          .select("fixture_id, prediction")
          .in("fixture_id", fixtureIds)
          .limit(10_000)
      : { data: [] };
    const countByFixture = new Map<number, Record<CommunityVoteOption, number>>();
    for (const row of votes ?? []) {
      const counts = countByFixture.get(Number(row.fixture_id)) ?? emptyCounts();
      if (row.prediction in counts) counts[row.prediction as CommunityVoteOption] += 1;
      countByFixture.set(Number(row.fixture_id), counts);
    }
    const polls = matches.map((match) => ({
      id: match.id,
      homeTeam: match.home.name,
      awayTeam: match.away.name,
      homeLogo: match.home.logo,
      awayLogo: match.away.logo,
      league: match.league.name,
      status: match.status,
      kickoff: match.kickoff,
      timeLabel: match.timeLabel,
      minute: match.minute,
      votes: countByFixture.get(match.id) ?? emptyCounts(),
    }));

    const leaderboard: CommunityOverview["leaderboard"] = [];
    try {
      const { data: analyses } = await db
        .from("ai_analyses")
        .select("user_id, settlement_status")
        .in("settlement_status", ["won", "lost"])
        .limit(10_000);
      const totals = new Map<string, { wins: number; settled: number }>();
      for (const row of analyses ?? []) {
        const current = totals.get(String(row.user_id)) ?? { wins: 0, settled: 0 };
        current.settled += 1;
        if (row.settlement_status === "won") current.wins += 1;
        totals.set(String(row.user_id), current);
      }
      const userIds = [...totals.keys()];
      if (userIds.length) {
        const { data: profiles } = await db
          .from("profiles")
          .select("id, display_name")
          .in("id", userIds);
        const names = new Map((profiles ?? []).map((profile: any) => [String(profile.id), profile.display_name]));
        [...totals.entries()]
          .sort((a, b) => b[1].wins - a[1].wins || b[1].settled - a[1].settled)
          .slice(0, 5)
          .forEach(([userId, stats], index) => {
            leaderboard.push({
              rank: index + 1,
              name: String(names.get(userId) || "Membre LiveFoot").slice(0, 80),
              ...stats,
            });
          });
      }
    } catch {
      // Le classement reste vide tant qu'aucune statistique fiable n'est disponible.
    }
    return { polls, messages: messagesResult, leaderboard, updatedAt, state };
  },
);

export const castCommunityVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => voteInput.parse(input))
  .handler(async ({ data, context }) => {
    const match = await isRealCommunityFixture(data.fixtureId);
    if (!match) throw new Error("Ce match n'est plus disponible pour le moment.");
    const db = await getDb();
    const { data: existing } = await db
      .from("community_predictions")
      .select("id")
      .eq("user_id", context.userId)
      .eq("fixture_id", data.fixtureId)
      .maybeSingle();
    if (existing) throw new Error("Vous avez déjà voté pour ce match.");
    const { data: profile } = await db
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", context.userId)
      .maybeSingle();
    const { error } = await db.from("community_predictions").insert({
      user_id: context.userId,
      user_name: String(profile?.display_name || "Membre LiveFoot").slice(0, 80),
      fixture_id: match.id,
      home_team: match.home.name,
      away_team: match.away.name,
      prediction: data.prediction,
    });
    if (error) throw new Error("Votre vote n'a pas pu être enregistré.");
    return readMatchVotes(match.id);
  });

export const postCommunityMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => messageInput.parse(input))
  .handler(async ({ data, context }) => {
    const message = data.message.replace(/<[^>]*>/g, "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
    if (!message) throw new Error("Écrivez un message avant de l'envoyer.");
    const db = await getDb();
    const since = new Date(Date.now() - 5000).toISOString();
    const { count } = await db
      .from("community_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("created_at", since);
    if ((count ?? 0) > 0) throw new Error("Attendez quelques secondes avant d'envoyer un autre message.");
    const { data: profile } = await db
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", context.userId)
      .maybeSingle();
    const { data: row, error } = await db
      .from("community_messages")
      .insert({
        user_id: context.userId,
        user_name: String(profile?.display_name || "Membre LiveFoot").slice(0, 80),
        user_avatar: profile?.avatar_url ? String(profile.avatar_url) : null,
        message: message.slice(0, 500),
        match_id: data.matchId ?? null,
      })
      .select("id, user_name, user_avatar, message, created_at, match_id")
      .single();
    if (error || !row) throw new Error("Votre message n'a pas pu être publié.");
    return readSafeMessage(row);
  });

// Used by the match detail page. It keeps its existing update behavior.
export const getMatchCommunityVotes = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ fixtureId: z.number().int().positive() }).parse(input))
  .handler(({ data }) => readMatchVotes(data.fixtureId));

export const castMatchCommunityVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => voteInput.parse(input))
  .handler(async ({ data, context }) => {
    const db = await getDb();
    const { data: profile } = await db
      .from("profiles")
      .select("display_name")
      .eq("id", context.userId)
      .maybeSingle();
    const { error } = await db.from("community_predictions").upsert(
      {
        user_id: context.userId,
        user_name: String(profile?.display_name || "Membre LiveFoot").slice(0, 80),
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
