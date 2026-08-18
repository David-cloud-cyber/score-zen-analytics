import "./lib/error-capture";

// Node 20 n'a pas de WebSocket natif — Supabase Realtime en a besoin côté SSR.
// On le polyfille avant tout autre import pour éviter le crash.
if (typeof globalThis.WebSocket === "undefined") {
  // @ts-expect-error WebSocket is intentionally installed on the Worker/Node global.
  const { WebSocket } = await import("ws");
  globalThis.WebSocket = WebSocket;
}

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { newIncidentId, recordServerIncident } from "./lib/incident.server";
import { getFixtureSections, getFixtureSummary } from "./lib/football.functions";
import { runEditorialCycle } from "./lib/editorial.pipeline.server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type LiveCoordinatorNamespace = {
  getByName: (name: string) => { fetch: (request: Request) => Promise<Response> };
};

const LIVE_COORDINATOR_NAME = "global";
const SHARED_LIVE_PATHS = new Set([
  "/api/fixtures/today",
  "/api/fixtures/live",
  "/api/live-stream",
]);

async function handleSharedLiveRequest(request: Request, env: unknown): Promise<Response | null> {
  const url = new URL(request.url);
  if (!SHARED_LIVE_PATHS.has(url.pathname)) return null;

  // TanStack Start invokes this server entry from Nitro without forwarding the
  // Cloudflare env argument. Nitro stores it on __env__ before dispatching the
  // SSR handler, so use it as the fallback for Worker-only bindings.
  const runtimeEnv = env ?? (globalThis as { __env__?: unknown }).__env__;
  const namespace = (runtimeEnv as { LIVE_FOOTBALL_COORDINATOR?: LiveCoordinatorNamespace } | undefined)
    ?.LIVE_FOOTBALL_COORDINATOR;
  if (!namespace) return null;

  return namespace.getByName(LIVE_COORDINATOR_NAME).fetch(request);
}

async function handleFixtureSectionRequest(request: Request): Promise<Response | null> {
  const match = new URL(request.url).pathname.match(/^\/api\/fixture\/(\d+)\/(summary|sections)$/);
  if (!match) return null;
  const id = Number(match[1]);
  const data = { id };
  try {
    const payload = match[2] === "summary"
      ? await getFixtureSummary({ data })
      : await getFixtureSections({ data });
    return new Response(JSON.stringify(payload), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "private, max-age=10, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    const incidentId = newIncidentId();
    void recordServerIncident({
      incidentId,
      route: new URL(request.url).pathname,
      category: "data",
      statusCode: 503,
    });
    // Keep provider details private. The public API only returns a stable,
    // user-facing state while the incident journal keeps the internal trace.
    void error;
    return new Response(
      JSON.stringify({ error: "Les informations de cette rencontre arrivent bientôt." }),
      {
        status: 503,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      },
    );
  }
}

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  const incidentId = newIncidentId();
  void recordServerIncident({ incidentId, category: "render", statusCode: 500 });
  consumeLastCapturedError();
  return new Response(renderErrorPage(incidentId), {
    status: 500,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, max-age=0, must-revalidate",
      pragma: "no-cache",
    },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

function preventHtmlAssetMismatch(response: Response): Response {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return response;

  // Les pages SSR contiennent des noms d'assets CSS/JS hashés. Ne pas mettre
  // leur HTML en cache évite qu'un téléphone conserve un ancien HTML qui
  // référence un asset supprimé lors d'un nouveau déploiement.
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  headers.set("Pragma", "no-cache");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const sharedLiveResponse = await handleSharedLiveRequest(request, env);
      if (sharedLiveResponse) return sharedLiveResponse;
      const fixtureSectionResponse = await handleFixtureSectionRequest(request);
      if (fixtureSectionResponse) return fixtureSectionResponse;

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      return preventHtmlAssetMismatch(normalized);
    } catch (error) {
      const incidentId = newIncidentId();
      void recordServerIncident({
        incidentId,
        route: new URL(request.url).pathname,
        category: "render",
        statusCode: 500,
      });
      return new Response(renderErrorPage(incidentId), {
        status: 500,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store, max-age=0, must-revalidate",
          pragma: "no-cache",
        },
      });
    }
  },
};

export async function scheduled(
  _controller: { cron?: string; scheduledTime?: number },
  env: unknown,
  ctx: { waitUntil: (promise: Promise<unknown>) => void },
) {
  (globalThis as typeof globalThis & { __env__?: unknown }).__env__ = env;
  ctx.waitUntil(runEditorialCycle());
}
