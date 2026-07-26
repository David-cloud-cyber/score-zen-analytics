import { createFileRoute } from "@tanstack/react-router";

// Webhook Fapshi : notifié sur SUCCESSFUL / FAILED / EXPIRED.
// Sécurité : en-tête `x-wh-secret` + re-vérification du statut auprès de Fapshi.
export const Route = createFileRoute("/api/public/fapshi-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.FAPSHI_WEBHOOK_SECRET;
        if (expected) {
          const got = request.headers.get("x-wh-secret");
          if (got !== expected) return new Response("Invalid secret", { status: 401 });
        }

        let payload: { transId?: string };
        try {
          payload = (await request.json()) as { transId?: string };
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const transId = payload?.transId;
        if (!transId || typeof transId !== "string") {
          return new Response("Missing transId", { status: 400 });
        }

        try {
          const { settlePayment } = await import("@/lib/payments.server");
          const outcome = await settlePayment(transId);
          return Response.json({ ok: true, status: outcome.status, credited: outcome.credited });
        } catch (err) {
          console.error("Fapshi webhook error", err);
          return new Response("Webhook processing failed", { status: 500 });
        }
      },
    },
  },
});
