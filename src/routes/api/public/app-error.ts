import { createFileRoute } from "@tanstack/react-router";
import { newIncidentId, recordServerIncident, type IncidentCategory } from "@/lib/incident.server";

type PublicError = {
  category?: unknown;
  route?: unknown;
  device?: unknown;
  viewport?: unknown;
  boundary?: unknown;
};

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.slice(0, max) : undefined;
}

function category(value: unknown): IncidentCategory {
  return value === "css" || value === "data" || value === "route" || value === "provider" || value === "timeout" || value === "quota" || value === "payment"
    ? value
    : "render";
}

export const Route = createFileRoute("/api/public/app-error")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const input = (await request.json()) as PublicError;
          await recordServerIncident({
            incidentId: newIncidentId(),
            route: text(input.route, 160),
            category: category(input.category),
            statusCode: 500,
            deviceFamily: input.device === "mobile" ? "mobile" : "desktop",
            browserFamily: "browser",
          });
        } catch {
          // Endpoint best-effort : l'erreur client ne doit jamais être aggravée.
        }
        return new Response(null, { status: 204 });
      },
    },
  },
});
