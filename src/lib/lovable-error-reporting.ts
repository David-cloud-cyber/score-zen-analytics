export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") {
    if (process.env.NODE_ENV !== "production") {
      console.error("[Local Error Reporter]", error, context);
    }
    return;
  }
  if (process.env.NODE_ENV !== "production") {
    console.error("[Local Error Reporter]", error, context);
  }
  const payload = JSON.stringify({
    category: "render",
    route: window.location.pathname,
    boundary: typeof context.boundary === "string" ? context.boundary.slice(0, 80) : "unknown",
    device: window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop",
    viewport: `${window.innerWidth}x${window.innerHeight}`.slice(0, 24),
  });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/public/app-error", new Blob([payload], { type: "application/json" }));
    } else {
      void fetch("/api/public/app-error", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => undefined);
    }
  } catch {
    // Le suivi ne doit jamais empêcher la récupération de la page.
  }
}
