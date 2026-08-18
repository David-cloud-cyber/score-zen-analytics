import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createIncidentId } from "@/lib/error-page";

export type IncidentCategory =
  | "data"
  | "route"
  | "render"
  | "css"
  | "provider"
  | "timeout"
  | "quota"
  | "payment";

export function newIncidentId() {
  return createIncidentId();
}

/** Journal privé best-effort : aucun secret, email, stack ou contenu utilisateur. */
export async function recordServerIncident(input: {
  incidentId: string;
  route?: string;
  category: IncidentCategory;
  statusCode?: number;
  deviceFamily?: "mobile" | "tablet" | "desktop";
  browserFamily?: string;
  deploymentVersion?: string;
  durationMs?: number;
  cacheId?: string | null;
}) {
  try {
    await supabaseAdmin.from("app_error_events").insert({
      incident_id: input.incidentId,
      route: (input.route ?? "/").split("?")[0].slice(0, 160),
      category: input.category,
      status_code: Math.max(0, Math.min(599, Math.floor(input.statusCode ?? 500))),
      device_family: input.deviceFamily ?? "desktop",
      browser_family: (input.browserFamily ?? "unknown").slice(0, 40),
      deployment_version: (input.deploymentVersion ?? "unknown").slice(0, 80),
      duration_ms:
        input.durationMs === undefined ? null : Math.max(0, Math.min(300_000, Math.floor(input.durationMs))),
      cache_id: input.cacheId?.slice(0, 120) ?? null,
    });
  } catch {
    // Le journal ne doit jamais transformer une récupération en nouvelle erreur.
  }
}
