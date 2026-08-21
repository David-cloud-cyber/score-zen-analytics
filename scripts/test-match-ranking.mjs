import assert from "node:assert/strict";
import { competitionPriority, rankMatches, selectTrendingMatch } from "../src/lib/match-ranking.ts";

const makeMatch = ({
  id,
  leagueId,
  leagueName,
  status = "upcoming",
  kickoff,
  homeId = 9000,
  awayId = 9001,
}) => ({
  id,
  status,
  statusShort: status === "live" ? "1H" : "NS",
  minute: status === "live" ? 30 : null,
  kickoff,
  timeLabel: "20:00",
  dayLabel: "Aujourd'hui",
  home: { id: homeId, name: `Home ${id}`, short: `H${id}`, logo: "" },
  away: { id: awayId, name: `Away ${id}`, short: `A${id}`, logo: "" },
  homeScore: status === "live" ? 1 : null,
  awayScore: status === "live" ? 0 : null,
  league: { id: leagueId, name: leagueName, country: "Test", logo: "", flag: null, season: 2026 },
  venue: null,
});

const now = Date.parse("2026-08-21T12:00:00.000Z");
const premierLeague = makeMatch({
  id: 1,
  leagueId: 39,
  leagueName: "Premier League",
  kickoff: "2026-08-21T18:00:00.000Z",
});
const obscureLeague = makeMatch({
  id: 2,
  leagueId: 999,
  leagueName: "Championnat régional",
  kickoff: "2026-08-21T13:00:00.000Z",
});
const liveObscure = makeMatch({
  id: 3,
  leagueId: 999,
  leagueName: "Championnat régional",
  status: "live",
  kickoff: "2026-08-21T11:00:00.000Z",
});
const laLigaByName = makeMatch({
  id: 4,
  leagueId: 1000,
  leagueName: "LaLiga",
  kickoff: "2026-08-21T19:00:00.000Z",
});

assert.equal(competitionPriority(premierLeague), 3);
assert.equal(competitionPriority(laLigaByName), 3);
assert.equal(competitionPriority(obscureLeague), 0);

const ranked = rankMatches([obscureLeague, premierLeague, liveObscure], { now });
assert.deepEqual(
  ranked.map(({ id }) => id),
  [liveObscure.id, premierLeague.id, obscureLeague.id],
  "Le direct reste prioritaire, puis le championnat majeur parmi les matchs à venir",
);

const trending = selectTrendingMatch([obscureLeague, premierLeague, liveObscure], undefined, now);
assert.equal(
  trending?.id,
  premierLeague.id,
  "Trending doit privilégier l'affiche majeure pertinente",
);

const favoriteRanked = rankMatches([premierLeague, obscureLeague], {
  favoriteMatchIds: [String(obscureLeague.id)],
  now,
});
assert.equal(favoriteRanked[0]?.id, obscureLeague.id, "Un favori explicite reste prioritaire");

console.log("match-ranking: ok");
