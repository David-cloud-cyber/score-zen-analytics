import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/push-click")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        const requested = url.searchParams.get("to") || "/";
        const target = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";
        if (token && /^[0-9a-f-]{36}$/i.test(token)) {
          await (supabaseAdmin as any).from("marketing_push_deliveries").update({ status: "clicked", clicked_at: new Date().toISOString() }).eq("click_token", token);
        }
        return Response.redirect(new URL(target, url.origin), 302);
      },
    },
  },
});

