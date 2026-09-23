import { createFileRoute } from "@tanstack/react-router";
import { settleChariowSale } from "@/lib/payments.server";
import { verifyChariowWebhookSignature, getChariowWebhookSecret } from "@/lib/chariow.server";

function saleFromPayload(payload: Record<string, unknown>) {
  const nested = payload.sale ?? (payload.data as Record<string, unknown> | undefined)?.sale ?? payload.data;
  return nested && typeof nested === "object" ? nested : null;
}

export const Route = createFileRoute("/api/public/chariow-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = await getChariowWebhookSecret();
        if (!secret) return new Response("Webhook not configured", { status: 503 });

        if (Number(request.headers.get("content-length") ?? 0) > 256_000) return new Response("Payload too large", { status: 413 });
        const rawBody = await request.text();
        if (rawBody.length > 256_000) return new Response("Payload too large", { status: 413 });
        if (!await verifyChariowWebhookSignature(rawBody, request.headers.get("x-chariow-signature"))) {
          return new Response("Invalid signature", { status: 401 });
        }

        try {
          const payload = JSON.parse(rawBody) as Record<string, unknown>;
          const sale = saleFromPayload(payload);
          const event = typeof payload.event === "string" ? payload.event.toLowerCase() : "";
          const relevant = new Set(["successful.sale", "sale.completed", "successful_sale", "sale.successful", "failed.sale", "abandoned.sale", "failed_sale", "abandoned_sale"]);
          const saleStatus = sale && typeof sale === "object" && typeof (sale as Record<string, unknown>).status === "string"
            ? String((sale as Record<string, unknown>).status).toLowerCase()
            : "";
          const statusEvent = ["completed", "settled", "successful", "failed", "abandoned", "cancelled"].includes(saleStatus);
          if (!sale || (!relevant.has(event) && !statusEvent)) return Response.json({ ok: true, ignored: true });

          const outcome = await settleChariowSale(sale as Parameters<typeof settleChariowSale>[0]);
          return Response.json({ ok: true, status: outcome.status, credited: outcome.credited });
        } catch (error) {
          console.error("Chariow webhook processing failed", error instanceof Error ? error.message : "unknown");
          return new Response("Webhook processing failed", { status: 500 });
        }
      },
    },
  },
});
