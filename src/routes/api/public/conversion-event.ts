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
  "referral_cta_click",
  "referral_cta_view",
  "referral_link_copy",
  "referral_share_click",
  "referral_invitation_confirmed",
  "referral_milestone_reached",
  "referral_milestone_progress_view",
  "affiliate_page_view",
  "affiliate_cta_click",
  "affiliate_commission_view",
  "affiliate_payout_profile_saved",
  "affiliate_payout_requested",
  "championship_directory_view",
  "championship_search",
]);

const conversionRate = new Map<string, { startedAt: number; count: number }>();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 120;

function rateKey(request: Request, sessionId: string) {
  const address =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ??
    "unknown";
  return `${address}:${sessionId}`;
}

function allowConversionEvent(request: Request, sessionId: string) {
  const now = Date.now();
  for (const [key, state] of conversionRate) {
    if (now - state.startedAt > RATE_WINDOW_MS) conversionRate.delete(key);
  }
  if (conversionRate.size > 2_000) conversionRate.clear();
  const key = rateKey(request, sessionId);
  const current = conversionRate.get(key);
  if (!current || now - current.startedAt > RATE_WINDOW_MS) {
    conversionRate.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= RATE_LIMIT) return false;
  current.count += 1;
  return true;
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : undefined;
}

function safeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(
        ([, item]) =>
          typeof item === "string" || typeof item === "number" || typeof item === "boolean",
      )
      .slice(0, 12)
      .map(([key, item]) => [
        key.slice(0, 40),
        typeof item === "string" ? item.slice(0, 160) : item,
      ]),
  );
}

export const Route = createFileRoute("/api/public/conversion-event")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const contentLength = Number(request.headers.get("content-length") ?? 0);
          if (contentLength > 20_000) return new Response(null, { status: 204 });
          const rawBody = await request.text();
          if (rawBody.length > 20_000) return new Response(null, { status: 204 });
          const input = JSON.parse(rawBody) as Record<string, unknown>;
          const event = text(input.event, 60);
          const sessionId = text(input.sessionId, 80);
          if (
            !event ||
            !ALLOWED_EVENTS.has(event) ||
            !sessionId ||
            !/^[a-zA-Z0-9_-]{16,80}$/.test(sessionId)
          ) {
            return new Response(null, { status: 204 });
          }
          if (!allowConversionEvent(request, sessionId)) return new Response(null, { status: 204 });

          let userId: string | null = null;
          const authorization = request.headers.get("authorization");
          const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
          if (bearer && bearer.length <= 4096) {
            try {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              const { data } = await supabaseAdmin.auth.getUser(bearer);
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
