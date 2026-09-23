import { createFileRoute } from "@tanstack/react-router";
import { settleSasPayTransaction } from "@/lib/payments.server";
import { getSasPayWebhookSecret, verifySasPayWebhookSignature, type SasPayTransaction } from "@/lib/saspay.server";

function transactionFromPayload(payload: Record<string, unknown>) {
  const data = payload.data;
  return data && typeof data === "object" ? data as Record<string, unknown> : payload;
}

export const Route = createFileRoute("/api/public/saspay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!await getSasPayWebhookSecret()) return new Response("Webhook non configuré", { status: 503 });

        if (Number(request.headers.get("content-length") ?? 0) > 256_000) return new Response("Payload too large", { status: 413 });
        const rawBody = await request.text();
        if (rawBody.length > 256_000) return new Response("Payload too large", { status: 413 });
        const signature = request.headers.get("x-webhook-signature");
        const timestamp = request.headers.get("x-webhook-timestamp");
        if (!await verifySasPayWebhookSignature(rawBody, signature, timestamp)) {
          return new Response("Signature invalide", { status: 401 });
        }

        try {
          const payload = JSON.parse(rawBody) as Record<string, unknown>;
          const event = request.headers.get("x-webhook-event") ?? (typeof payload.event === "string" ? payload.event : "");
          const transaction = transactionFromPayload(payload);
          const id = typeof transaction.id === "string" ? transaction.id.trim() : "";
          if (!id || !event.startsWith("transaction.")) return Response.json({ ok: true, ignored: true });

          const outcome = await settleSasPayTransaction(transaction as SasPayTransaction);
          // Do not acknowledge a success whose checkout is not visible yet.
          // SasPay retries non-2xx deliveries, covering session/webhook races.
          if (outcome.status === "UNKNOWN" || (event === "transaction.success" && outcome.status === "PENDING")) {
            return new Response("Paiement en cours de rapprochement", { status: 503 });
          }
          return Response.json({ ok: true, status: outcome.status, credited: outcome.credited });
        } catch (error) {
          console.error("SasPay webhook processing failed", error instanceof Error ? error.message : "unknown");
          return new Response("Webhook processing failed", { status: 500 });
        }
      },
    },
  },
});
