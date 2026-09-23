import { apiFootball } from "./apifootball.server";
import { readSharedFixtureSnapshot } from "./football.functions";
import type { RemoteMatchSummary } from "./football-types";
import { buildStatisticalPrediction, type TeamPredictionContext } from "./prediction-engine";
import {
  getRuntimeBinding,
  type DurableObjectNamespaceBinding,
  type RuntimeBinding,
} from "./config.server";

type DailyRow = {
  id: string;
  prediction_date: string;
  fixture_id: number;
  kickoff: string;
  home_team: string;
  away_team: string;
  home_logo: string | null;
  away_logo: string | null;
  league_id: number;
  league_name: string;
  league_logo: string | null;
  market_key: "1X2" | "double_chance";
  market_label: string;
  pick: string;
  probability: number;
  confidence: number;
  risk: "bas" | "moyen" | "eleve";
  rationale: string;
  factors: string[];
  source_fetched_at: string;
  engine_version: string;
  status: "pending" | "won" | "lost" | "unresolvable";
  final_score: string | null;
  settled_at: string | null;
  display_rank: number;
  created_at: string;
};

type ProviderPrediction = {
  predictions?: {
    percent?: { home?: string; draw?: string; away?: string };
    advice?: string | null;
  };
};

type OddsResponse = {
  bookmakers?: Array<{
    bets?: Array<{
      name: string;
      values?: Array<{ value: string; odd: string }>;
    }>;
  }>;
};

type AttemptState = {
  lastAttempt: number;
  fixtures: Record<string, number>;
};

const TARGET_PREDICTIONS = 8;
const MAX_CANDIDATES_PER_RUN = 12;
const MIN_LEAD_TIME_MS = 20 * 60_000;
const STORAGE_PREFIX = "daily-predictions:v1";
const STORAGE_TTL_SECONDS = 45 * 24 * 60 * 60;
const ATTEMPT_COOLDOWN_MS = 30 * 60_000;
const CANDIDATE_RETRY_MS = 3 * 60 * 60_000;
const SETTLEMENT_COOLDOWN_MS = 10 * 60_000;

function predictionStore() {
  return getRuntimeBinding<RuntimeBinding>("FOOTBALL_CACHE");
}

function predictionCoordinator() {
  return getRuntimeBinding<DurableObjectNamespaceBinding>("LIVE_FOOTBALL_COORDINATOR")?.getByName(
    "global",
  );
}

async function readCoordinatorState<T>(kind: "rows" | "attempt" | "settlement", date: string) {
  const coordinator = predictionCoordinator();
  if (!coordinator) return null;
  try {
    const response = await coordinator.fetch(
      new Request(
        `https://livefoot.internal/api/daily-predictions?kind=${kind}&date=${encodeURIComponent(date)}`,
      ),
    );
    if (!response.ok) return null;
    return (await response.json()) as T | null;
  } catch {
    return null;
  }
}

async function writeCoordinatorState(
  kind: "rows" | "attempt" | "settlement",
  date: string,
  value: unknown,
) {
  const coordinator = predictionCoordinator();
  if (!coordinator) return false;
  try {
    const response = await coordinator.fetch(
      new Request(
        `https://livefoot.internal/api/daily-predictions?kind=${kind}&date=${encodeURIComponent(date)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(value),
        },
      ),
    );
    return response.ok;
  } catch {
    return false;
  }
}

function storageKey(date: string) {
  return `${STORAGE_PREFIX}:${date}`;
}

function attemptKey(date: string) {
  return `${STORAGE_PREFIX}:attempt-v7:${date}`;
}

function settlementKey() {
  return `${STORAGE_PREFIX}:settlement`;
}

async function readAttemptState(date: string): Promise<AttemptState> {
  const coordinated = await readCoordinatorState<AttemptState>("attempt", date);
  if (coordinated) {
    return {
      lastAttempt: Number(coordinated.lastAttempt) || 0,
      fixtures:
        coordinated.fixtures && typeof coordinated.fixtures === "object"
          ? Object.fromEntries(
              Object.entries(coordinated.fixtures).filter(([, timestamp]) =>
                Number.isFinite(Number(timestamp)),
              ),
            )
          : {},
    };
  }
  const store = predictionStore();
  if (!store) return { lastAttempt: 0, fixtures: {} };
  let value: unknown = null;
  try {
    value = await store.get(attemptKey(date), { type: "text", cacheTtl: 60 });
  } catch {
    return { lastAttempt: 0, fixtures: {} };
  }
  const legacyTimestamp = Number(value);
  if (Number.isFinite(legacyTimestamp)) return { lastAttempt: legacyTimestamp, fixtures: {} };
  try {
    const parsed = JSON.parse(String(value ?? "")) as Partial<AttemptState>;
    return {
      lastAttempt: Number(parsed.lastAttempt) || 0,
      fixtures:
        parsed.fixtures && typeof parsed.fixtures === "object"
          ? Object.fromEntries(
              Object.entries(parsed.fixtures).filter(([, timestamp]) =>
                Number.isFinite(Number(timestamp)),
              ),
            )
          : {},
    };
  } catch {
    return { lastAttempt: 0, fixtures: {} };
  }
}

async function recordAttempt(date: string, state: AttemptState, fixtureIds: number[]) {
  const now = Date.now();
  const fixtures = Object.fromEntries(
    Object.entries(state.fixtures).filter(([, timestamp]) => now - timestamp < CANDIDATE_RETRY_MS),
  );
  for (const fixtureId of fixtureIds) fixtures[String(fixtureId)] = now;
  const nextState = { lastAttempt: now, fixtures } satisfies AttemptState;
  if (await writeCoordinatorState("attempt", date, nextState)) return;
  try {
    await predictionStore()?.put(attemptKey(date), JSON.stringify(nextState), {
      expirationTtl: 24 * 60 * 60,
    });
  } catch {
    // A KV quota must not prevent the next request from serving a valid
    // calculation. The coordinator remains the preferred durable store.
  }
}

async function saveRows(date: string, rows: DailyRow[]) {
  if (await writeCoordinatorState("rows", date, rows)) return;
  const store = predictionStore();
  if (!store) return;
  try {
    await store.put(storageKey(date), JSON.stringify(rows), {
      expirationTtl: STORAGE_TTL_SECONDS,
    });
  } catch {
    // KV is a cache here. If its write quota is exhausted, predictions are
    // still persisted in the Durable Object above.
  }
}

async function loadRows(date: string): Promise<DailyRow[]> {
  const coordinated = await readCoordinatorState<DailyRow[]>("rows", date);
  if (Array.isArray(coordinated)) return coordinated;
  const store = predictionStore();
  if (!store) return [];
  try {
    const value = await store.get(storageKey(date), { type: "json", cacheTtl: 60 });
    return Array.isArray(value) ? (value as DailyRow[]) : [];
  } catch {
    return [];
  }
}

function dateInDouala(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Douala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function percent(value?: string) {
  const parsed = Number(
    String(value ?? "")
      .replace("%", "")
      .trim(),
  );
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : null;
}

function normalize(values: { home: number; draw: number; away: number }) {
  const total = values.home + values.draw + values.away;
  if (!total) return null;
  return {
    home: (values.home / total) * 100,
    draw: (values.draw / total) * 100,
    away: (values.away / total) * 100,
  };
}

function marketProbabilities(row?: OddsResponse) {
  const selections = { home: [] as number[], draw: [] as number[], away: [] as number[] };
  const labels: Record<string, keyof typeof selections> = {
    home: "home",
    draw: "draw",
    away: "away",
  };
  for (const bookmaker of row?.bookmakers ?? []) {
    const bet = bookmaker.bets?.find((item) => item.name.toLowerCase() === "match winner");
    for (const value of bet?.values ?? []) {
      const key = labels[value.value.toLowerCase()];
      const odd = Number(value.odd);
      if (key && Number.isFinite(odd) && odd > 1) selections[key].push(1 / odd);
    }
  }
  if (!selections.home.length || !selections.draw.length || !selections.away.length) return null;
  const average = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  return normalize({
    home: average(selections.home),
    draw: average(selections.draw),
    away: average(selections.away),
  });
}

function settlePick(row: DailyRow, match: RemoteMatchSummary) {
  if (match.status !== "finished" || match.homeScore === null || match.awayScore === null)
    return null;
  const outcome =
    match.homeScore > match.awayScore
      ? "home"
      : match.homeScore < match.awayScore
        ? "away"
        : "draw";
  const pick = row.pick.toLowerCase();
  const selected = pick.includes(row.home_team.toLowerCase())
    ? "home"
    : pick.includes(row.away_team.toLowerCase())
      ? "away"
      : pick.includes("nul")
        ? "draw"
        : null;
  if (!selected) return "unresolvable" as const;
  const won =
    row.market_key === "double_chance"
      ? selected === "home"
        ? outcome !== "away"
        : outcome !== "home"
      : selected === outcome;
  return won ? ("won" as const) : ("lost" as const);
}

async function settleExisting(rows: DailyRow[], matches: RemoteMatchSummary[]) {
  const byId = new Map(matches.map((match) => [match.id, match]));
  let changed = false;
  for (const row of rows.filter((item) => item.status === "pending")) {
    const match = byId.get(Number(row.fixture_id));
    if (!match) continue;
    const status = settlePick(row, match);
    if (!status) continue;
    row.status = status;
    row.final_score = `${match.homeScore}-${match.awayScore}`;
    row.settled_at = new Date().toISOString();
    changed = true;
  }
  return changed;
}

async function settleRecentPredictionDays(days = 4) {
  const store = predictionStore();
  const coordinatedSettlement = await readCoordinatorState<number>("settlement", "global");
  let lastSettlement = coordinatedSettlement === null ? Number.NaN : Number(coordinatedSettlement);
  if (!Number.isFinite(lastSettlement)) {
    try {
      lastSettlement = Number(
        await store?.get(settlementKey(), { type: "text", cacheTtl: 60 }),
      );
    } catch {
      lastSettlement = 0;
    }
  }
  if (Number.isFinite(lastSettlement) && Date.now() - lastSettlement < SETTLEMENT_COOLDOWN_MS)
    return;
  for (let offset = 1; offset <= days; offset += 1) {
    const day = new Date();
    day.setUTCDate(day.getUTCDate() - offset);
    const date = dateInDouala(day);
    const rows = await loadRows(date);
    if (!rows.some((row) => row.status === "pending")) continue;
    const snapshot = await readSharedFixtureSnapshot("day", date);
    if (!snapshot?.matches.length) continue;
    if (await settleExisting(rows, snapshot.matches)) await saveRows(date, rows);
  }
  const now = Date.now();
  if (await writeCoordinatorState("settlement", "global", now)) return;
  try {
    await store?.put(settlementKey(), String(now), { expirationTtl: 24 * 60 * 60 });
  } catch {
    // Settlement is best-effort and must not block today's generation.
  }
}

type RecentFixture = {
  fixture: { date: string; status: { short: string } };
  league: { id: number };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: { home: number | null; away: number | null };
};

type Standing = {
  team: { id: number };
  rank: number;
  points: number;
  goalsDiff: number;
};

type StatisticalFallback = {
  marketKey: "1X2" | "double_chance";
  marketLabel: string;
  pick: string;
  probability: number;
  confidence: number;
  risk: "bas" | "moyen" | "eleve";
  rationale: string;
  factors: string[];
};

function teamContextFromRecent(
  id: number,
  name: string,
  fixtures: RecentFixture[],
  standings: Map<number, Standing>,
  competitionId: number,
): TeamPredictionContext {
  const recent = fixtures
    .filter((fixture) => fixture.goals.home !== null && fixture.goals.away !== null)
    .map((fixture) => {
      const isHome = fixture.teams.home.id === id;
      const goalsFor = isHome ? fixture.goals.home : fixture.goals.away;
      const goalsAgainst = isHome ? fixture.goals.away : fixture.goals.home;
      const result =
        goalsFor === null || goalsAgainst === null
          ? ("?" as const)
          : goalsFor > goalsAgainst
            ? ("W" as const)
            : goalsFor < goalsAgainst
              ? ("L" as const)
              : ("D" as const);
      return {
        isHome,
        goalsFor,
        goalsAgainst,
        result,
        sameCompetition: fixture.league.id === competitionId,
      };
    });
  const standing = standings.get(id);
  return {
    id,
    name,
    recent,
    injuries: [],
    rank: standing?.rank ?? null,
    points: standing?.points ?? null,
    goalsDiff: standing?.goalsDiff ?? null,
    season: null,
    dataQuality: recent.length >= 5 ? "complete" : "partial",
  };
}

async function buildStatisticalFallback(match: RemoteMatchSummary): Promise<StatisticalFallback | null> {
  const [homeResult, awayResult, standingsResult] = await Promise.all([
    apiFootball<RecentFixture[]>("/fixtures", { team: match.home.id, last: 10 }).catch(() => []),
    apiFootball<RecentFixture[]>("/fixtures", { team: match.away.id, last: 10 }).catch(() => []),
    apiFootball<Array<{ league: { standings: Array<Standing[]> } }>>("/standings", {
      league: match.league.id,
      season: match.league.season,
    }).catch(() => []),
  ]);
  const standings = new Map(
    standingsResult.flatMap((row) => row.league.standings.flat()).map((row) => [row.team.id, row]),
  );
  const home = teamContextFromRecent(
    match.home.id,
    match.home.name,
    homeResult,
    standings,
    match.league.id,
  );
  const away = teamContextFromRecent(
    match.away.id,
    match.away.name,
    awayResult,
    standings,
    match.league.id,
  );
  // Do not fall back to internal defaults: both teams must have a meaningful
  // real sample before a daily selection can be shown publicly.
  if (home.recent.length < 5 || away.recent.length < 5) return null;

  const base = buildStatisticalPrediction({
    home,
    away,
    h2h: [],
    odds: null,
    live: null,
    signals: {
      competition: {
        id: match.league.id,
        name: match.league.name,
        importance: 0.35,
      },
    },
  });
  const market = base.markets.find(
    (item) =>
      item.label === "Double chance" &&
      typeof item.probability === "number" &&
      !item.pick.toLowerCase().includes("aucune"),
  ) ?? base.markets.find(
    (item) =>
      item.label === "Issue du match" &&
      typeof item.probability === "number" &&
      !item.pick.toLowerCase().includes("aucune"),
  );
  const probability = market?.probability ?? 0;
  const quality = base.dataQuality?.score ?? 0;
  if (!market || probability < 70 || market.confidence < 60 || quality < 52) return null;
  return {
    marketKey: market.label === "Issue du match" ? "1X2" : "double_chance",
    marketLabel: market.label,
    pick: market.pick,
    probability,
    confidence: market.confidence,
    risk: market.risk,
    rationale: `${market.rationale} Cette sélection repose sur la forme récente et le classement réellement disponibles, sans cote ni projection fournisseur inventée.`,
    factors: [
      ...base.keyFactors.slice(0, 3),
      `Échantillon vérifié : ${home.recent.length} matchs pour ${home.name} et ${away.recent.length} pour ${away.name}.`,
    ].slice(0, 4),
  };
}

async function buildPrediction(match: RemoteMatchSummary, rank: number, predictionDate: string) {
  const [providerRows, oddsRows] = await Promise.all([
    apiFootball<ProviderPrediction[]>("/predictions", {
      fixture: match.id,
    }).catch(() => []),
    apiFootball<OddsResponse[]>("/odds", {
      fixture: match.id,
      bet: 1,
    }).catch(() => []),
  ]);
  const provider = providerRows[0]?.predictions;
  const providerProbabilities = normalize({
    home: percent(provider?.percent?.home) ?? 0,
    draw: percent(provider?.percent?.draw) ?? 0,
    away: percent(provider?.percent?.away) ?? 0,
  });
  const market = marketProbabilities(oddsRows[0]);
  // Les deux sources restent prioritaires. Lorsque l'une des APIs est
  // temporairement indisponible, une source réelle unique peut toutefois
  // produire une sélection uniquement avec un seuil plus strict. Cela évite
  // une page vide sans jamais fabriquer de donnée.
  if (!providerProbabilities && !market) {
    const fallback = await buildStatisticalFallback(match);
    if (!fallback) return null;
    const now = new Date().toISOString();
    return {
      prediction_date: predictionDate,
      fixture_id: match.id,
      kickoff: match.kickoff,
      home_team: match.home.name,
      away_team: match.away.name,
      home_logo: match.home.logo || null,
      away_logo: match.away.logo || null,
      league_id: match.league.id,
      league_name: match.league.name,
      league_logo: match.league.logo || null,
      market_key: fallback.marketKey,
      market_label: fallback.marketLabel,
      pick: fallback.pick,
      probability: Math.round(fallback.probability),
      confidence: Math.min(84, Math.max(60, Math.round(fallback.confidence))),
      risk: fallback.risk,
      rationale: `${fallback.rationale} La sélection reste une estimation et non une garantie.`,
      factors: fallback.factors,
      source_fetched_at: now,
      engine_version: "daily-v1.5.0",
      display_rank: rank,
      updated_at: now,
    };
  }
  const hasTwoSources = Boolean(providerProbabilities && market);
  if (providerProbabilities && market) {
    const sourceDivergence = Math.max(
      Math.abs(providerProbabilities.home - market.home),
      Math.abs(providerProbabilities.draw - market.draw),
      Math.abs(providerProbabilities.away - market.away),
    );
    if (sourceDivergence > 12) return null;
  }
  const blend = providerProbabilities && market
    ? {
        home: providerProbabilities.home * 0.78 + market.home * 0.22,
        draw: providerProbabilities.draw * 0.78 + market.draw * 0.22,
        away: providerProbabilities.away * 0.78 + market.away * 0.22,
      }
    : (providerProbabilities ?? market)!;
  const entries = (Object.entries(blend) as Array<["home" | "draw" | "away", number]>).sort(
    (a, b) => b[1] - a[1],
  );
  const [winner, winnerProbability] = entries[0];
  const margin = winnerProbability - entries[1][1];
  if (winner === "draw" || winnerProbability < 40 || margin < 2) return null;
  const opponent = winner === "home" ? "away" : "home";
  const useStraightWinner = hasTwoSources
    ? winnerProbability >= 62 && margin >= 12
    : winnerProbability >= 68 && margin >= 18;
  if (providerProbabilities && market) {
    const marketWinner = (Object.entries(market) as Array<["home" | "draw" | "away", number]>).sort(
      (a, b) => b[1] - a[1],
    )[0][0];
    if (useStraightWinner ? marketWinner !== winner : market[opponent] > 38) return null;
  }
  const team = winner === "home" ? match.home.name : match.away.name;
  const doubleChanceProbability = Math.min(92, Math.round(winnerProbability + blend.draw));
  const probability = useStraightWinner
    ? Math.min(88, Math.round(winnerProbability))
    : doubleChanceProbability;
  const confidence = Math.min(84, Math.max(62, probability - (hasTwoSources ? 2 : 8)));
  if (confidence < 66 || (!useStraightWinner && probability < (hasTwoSources ? 78 : 84))) return null;
  const advice = provider?.advice?.trim();
  const sourceDescription = hasTwoSources
    ? "La projection statistique et les probabilités issues des cotes disponibles convergent."
    : providerProbabilities
      ? "La projection fournisseur réelle présente un avantage suffisamment net ; les cotes ne sont pas disponibles pour cette rencontre."
      : "Le consensus réel des cotes disponibles présente un avantage suffisamment net ; la projection fournisseur est indisponible pour cette rencontre.";
  return {
    prediction_date: predictionDate,
    fixture_id: match.id,
    kickoff: match.kickoff,
    home_team: match.home.name,
    away_team: match.away.name,
    home_logo: match.home.logo || null,
    away_logo: match.away.logo || null,
    league_id: match.league.id,
    league_name: match.league.name,
    league_logo: match.league.logo || null,
    market_key: useStraightWinner ? "1X2" : "double_chance",
    market_label: useStraightWinner ? "Issue du match" : "Double chance",
    pick: useStraightWinner ? team : `${team} ou nul`,
    probability,
    confidence,
    risk: confidence >= 76 ? "bas" : "moyen",
    rationale: `${sourceDescription} La sélection reste une estimation et non une garantie.`,
    factors: [
      `Projection publiée avant le coup d’envoi : ${probability}% pour le marché retenu.`,
      hasTwoSources
        ? "Le consensus des cotes disponibles va dans la même direction."
        : providerProbabilities
          ? "La sélection repose sur la projection fournisseur réelle disponible, avec un seuil renforcé."
          : "La sélection repose sur les cotes réelles disponibles, corrigées de leur marge, avec un seuil renforcé.",
      advice
        ? `Lecture complémentaire : ${advice.slice(0, 180)}`
        : `Compétition : ${match.league.name}.`,
    ],
    source_fetched_at: new Date().toISOString(),
    engine_version: "daily-v1.4.0",
    display_rank: rank,
    updated_at: new Date().toISOString(),
  };
}

export async function ensureDailyPredictions() {
  await settleRecentPredictionDays();
  const date = dateInDouala();
  const existing = await loadRows(date);
  const attemptState = await readAttemptState(date);
  const generationOnCooldown =
    existing.length < TARGET_PREDICTIONS &&
    Date.now() - attemptState.lastAttempt < ATTEMPT_COOLDOWN_MS;
  // Utiliser la même date locale que le stockage public. À minuit UTC, la
  // date du fournisseur peut déjà être différente de celle affichée au
  // Cameroun, ce qui produisait une liste vide malgré des matchs disponibles.
  const snapshot = await readSharedFixtureSnapshot("day", date);
  const matches = snapshot?.matches ?? [];
  const settled = await settleExisting(existing, matches);
  if (existing.length >= TARGET_PREDICTIONS || !matches.length || generationOnCooldown) {
    if (settled) await saveRows(date, existing);
    return { date, generated: 0, total: existing.length };
  }
  const existingIds = new Set(existing.map((row) => Number(row.fixture_id)));
  const now = Date.now();
  const candidates = matches
    .filter(
      (match) =>
        match.status === "upcoming" &&
        new Date(match.kickoff).getTime() - now >= MIN_LEAD_TIME_MS &&
        !existingIds.has(match.id) &&
        now - (attemptState.fixtures[String(match.id)] ?? 0) >= CANDIDATE_RETRY_MS,
    )
    .slice(0, MAX_CANDIDATES_PER_RUN);
  let generated = 0;
  for (const match of candidates) {
    if (existing.length >= TARGET_PREDICTIONS) break;
    const prediction = await buildPrediction(match, existing.length + 1, date);
    if (!prediction) continue;
    existing.push({
      ...prediction,
      id: crypto.randomUUID(),
      status: "pending",
      final_score: null,
      settled_at: null,
      created_at: new Date().toISOString(),
    } as DailyRow);
    generated += 1;
  }
  await recordAttempt(
    date,
    attemptState,
    candidates.map((match) => match.id),
  );
  if (generated || settled) await saveRows(date, existing);
  return { date, generated, total: existing.length };
}

let ensureInflight: Promise<Awaited<ReturnType<typeof ensureDailyPredictions>>> | null = null;

export function ensureDailyPredictionsDeduped() {
  if (ensureInflight) return ensureInflight;
  ensureInflight = ensureDailyPredictions().finally(() => {
    ensureInflight = null;
  });
  return ensureInflight;
}

export async function readDailyRows(date = dateInDouala()) {
  return (await loadRows(date)).sort((a, b) => a.display_rank - b.display_rank);
}

export async function readPublicHistoryRows(limit = 80) {
  const dates = Array.from({ length: 45 }, (_, offset) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - offset);
    return dateInDouala(date);
  });
  const rows = (await Promise.all(dates.map((date) => loadRows(date)))).flat();
  return rows
    .sort(
      (a, b) =>
        b.prediction_date.localeCompare(a.prediction_date) || a.display_rank - b.display_rank,
    )
    .slice(0, limit);
}

export { dateInDouala, type DailyRow };
