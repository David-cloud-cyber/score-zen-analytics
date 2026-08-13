import { createFileRoute } from "@tanstack/react-router";

type Diagnostic = {
  reason?: string;
  errorCode?: string;
  stylesLoaded?: boolean;
  matchesCount?: number;
  cacheId?: string | null;
  page?: string;
  device?: string;
  viewport?: string;
  userAgent?: string;
  at?: string;
};

function validText(value: unknown, max: number) {
  return typeof value === "string" ? value.slice(0, max) : undefined;
}

export const Route = createFileRoute("/api/public/fixture-diagnostic")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const input = (await request.json()) as Diagnostic;
          const record = {
            reason: validText(input.reason, 40),
            errorCode: validText(input.errorCode, 40),
            stylesLoaded: input.stylesLoaded === true,
            matchesCount:
              typeof input.matchesCount === "number"
                ? Math.max(0, Math.min(10_000, Math.floor(input.matchesCount)))
                : 0,
            cacheId: validText(input.cacheId, 80),
            page: validText(input.page, 80),
            device: input.device === "mobile" ? "mobile" : "desktop",
            viewport: validText(input.viewport, 24),
            userAgent: validText(input.userAgent, 120),
            at: validText(input.at, 40),
          };
          console.warn("Fixture diagnostic", JSON.stringify(record));
        } catch {
          // Diagnostics are best-effort and must not expose a server error to users.
        }
        return new Response(null, { status: 204 });
      },
    },
  },
});
