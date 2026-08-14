import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_EVENTS = new Set([
  "landing_view",
  "cta_view",
  "cta_click",
  "analyse_view",
  "analyse_run",
  "signup_started",
  "signup_completed",
  "analysis_result_view",
  "premium_view",
  "premium_cta_click",
  "premium_checkout_started",
  "premium_checkout_redirected",
  "promo_code_copy",
  "promo_affiliate_click",
]);

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : undefined;
}

function safeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => typeof item === "string" || typeof item === "number" || typeof item === "boolean")
      .slice(0, 12)
      .map(([key, item]) => [key.slice(0, 40), typeof item === "string" ? item.slice(0, 160) : item]),
  );
}

export const Route = createFileRoute("/api/public/conversion-event")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const input = (await request.json()) as Record<string, unknown>;
          const event = text(input.event, 60);
          const sessionId = text(input.sessionId, 80);
          if (!event || !ALLOWED_EVENTS.has(event) || !sessionId || !/^[a-zA-Z0-9_-]{16,80}$/.test(sessionId)) {
            return new Response(null, { status: 204 });
          }

          let userId: string | null = null;
          const authorization = request.headers.get("authorization");
          if (authorization?.startsWith("Bearer ")) {
            try {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              const { data } = await supabaseAdmin.auth.getUser(authorization.slice(7));
              userId = data.user?.id ?? null;
            } catch {
              // Les événements anonymes restent valides si la session n'est pas authentifiée.
            }
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = supabaseAdmin as unknown as {
            from: (table: string) => {
              insert: (row: Record<string, unknown>) => Promise<unknown>;
            };
          };
          await db.from("conversion_events").insert({
            event_name: event,
            session_id: sessionId,
            user_id: userId,
            route: text(input.route, 120),
            source: text(input.source, 80),
            medium: text(input.medium, 80),
            campaign: text(input.campaign, 120),
            metadata: safeMetadata(input.metadata),
          });
        } catch {
          // La mesure est best-effort et ne doit jamais perturber le parcours public.
        }
        return new Response(null, { status: 204 });
      },
    },
  },
});
