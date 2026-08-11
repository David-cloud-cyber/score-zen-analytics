import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

/**
 * Garde une seule origine indexable : HTTPS + www.
 * Cette redirection serveur évite que Cloudflare expose une seconde copie 200
 * de chaque page sur http:// ou sur le domaine nu.
 */
const canonicalHostMiddleware = createMiddleware().server(async ({ next, request }) => {
  const url = new URL(request.url);
  const isLiveFootHost = url.hostname === "livefoot.fun" || url.hostname === "www.livefoot.fun";

  if (!isLiveFootHost) return next();

  let visitorProtocol = url.protocol;
  const cfVisitor = request.headers.get("cf-visitor");
  if (cfVisitor) {
    try {
      const parsed = JSON.parse(cfVisitor) as { scheme?: string };
      if (parsed.scheme === "http" || parsed.scheme === "https") {
        visitorProtocol = `${parsed.scheme}:`;
      }
    } catch {
      // Header absent ou mal formé : le protocole de l'URL reste la source de repli.
    }
  }

  if (visitorProtocol === "https:" && url.hostname === "www.livefoot.fun") return next();

  url.protocol = "https:";
  url.hostname = "www.livefoot.fun";
  url.port = "";
  return new Response(null, {
    status: 308,
    headers: {
      Location: url.toString(),
      "Cache-Control": "public, max-age=86400",
    },
  });
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [canonicalHostMiddleware, errorMiddleware],
}));
