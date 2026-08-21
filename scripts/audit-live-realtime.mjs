import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const coordinator = read("src/lib/live-football-coordinator.ts");
const shared = read("src/lib/live-football.shared.ts");
const api = read("src/lib/apifootball.server.ts");
const stream = read("src/hooks/use-live-fixture-stream.ts");
const server = read("src/server.ts");
const matchRoute = read("src/routes/live.$id.tsx");

const checks = [
  ["cadence saine 10 secondes", shared.includes("LIVE_REFRESH_MS = 10_000")],
  ["cadence de vigilance 15 secondes", shared.includes("LIVE_CAUTION_REFRESH_MS = 15_000")],
  ["cadence dégradée 30 secondes", shared.includes("LIVE_DEGRADED_REFRESH_MS = 30_000")],
  ["clés de snapshots versionnées", coordinator.includes("lf:shared:v2:")],
  [
    "proxy interne des données fournisseur",
    coordinator.includes('url.pathname === "/api/upstream"'),
  ],
  ["souscription à une rencontre", coordinator.includes('payload.type !== "subscribe"')],
  ["messages de mise à jour de rencontre", coordinator.includes('type: "fixture_update"')],
  ["accès serveur coordonné", api.includes("requestCoordinated")],
  ["repli HTTP côté fiche", stream.includes("/api/fixture/${fixtureId}/summary")],
  [
    "binding Worker disponible avant les routes live",
    server.includes(").__env__ = env;") &&
      server.indexOf(").__env__ = env;") <
        server.indexOf("handleSharedLiveRequest(request, env)"),
  ],
  [
    "mise à jour score sans rechargement complet",
    stream.includes("onUpdateRef.current(payload.summary, payload.fetchedAt)") &&
      matchRoute.includes("queryClient.setQueryData<RemoteMatchDetail>"),
  ],
  [
    "sections non invalidées à chaque score",
    !matchRoute.includes('invalidateQueries({ queryKey: ["fixture-sections", fixtureId] })'),
  ],
  [
    "score live prioritaire sur les sections plus anciennes",
    matchRoute.includes("homeScore: summary.homeScore") &&
      matchRoute.includes("minute: summary.minute"),
  ],
  ["aucune clé fournisseur dans le client", !stream.includes("APIFOOTBALL_KEY")],
];

const failures = checks.filter(([, passed]) => !passed).map(([label]) => label);
if (failures.length > 0) {
  console.error("Audit temps réel échoué :");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Audit temps réel réussi : ${checks.length} contrôles.`);
}
