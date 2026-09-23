import { createFileRoute } from "@tanstack/react-router";
import { settleRelayitEvent } from "@/lib/payments.server";
import { getRelayitWebhookSecret, verifyRelayitWebhookSignature } from "@/lib/relayit.server";

export const Route = createFileRoute("/api/public/relayit-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!await getRelayitWebhookSecret()) return new Response("Webhook Relayit non configuré", { status: 503 });

        if (Number(request.headers.get("content-length") ?? 0) > 256_000) return new Response("Payload too large", { status: 413 });
        const rawBody = await request.text();
        if (rawBody.length > 256_000) return new Response("Payload too large", { status: 413 });

        const signature = request.headers.get("x-relayit-signature");
        const timestamp = request.headers.get("x-relayit-timestamp");
        if (!await verifyRelayitWebhookSignature(rawBody, signature, timestamp)) {
          return new Response("Signature Relayit invalide", { status: 401 });
        }

        try {
          const parsed: unknown = JSON.parse(rawBody);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return new Response("Invalid webhook payload", { status: 400 });
          }
          const payload = parsed as Record<string, unknown>;
          const outcome = await settleRelayitEvent(payload, request.headers.get("x-relayit-event"));
          // A temporary race between checkout creation and persistence must be
          // retried by Relayit rather than acknowledged as a successful event.
          if (outcome.status === "UNKNOWN") {
            return new Response("Paiement en cours de rapprochement", { status: 503 });
          }
          return Response.json({ ok: true, status: outcome.status, credited: outcome.credited });
        } catch (error) {
          console.error("Relayit webhook processing failed", error instanceof Error ? error.message : "unknown");
          return new Response("Webhook processing failed", { status: 500 });
        }
      },
    },
  },
});
