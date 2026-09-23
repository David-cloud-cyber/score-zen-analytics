import { createFileRoute } from "@tanstack/react-router";
// Fapshi est désactivé pour les nouveaux paiements. SasPay est le fournisseur
// actif et reçoit les notifications sur /api/public/saspay-webhook.
export const Route = createFileRoute("/api/public/fapshi-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        void request;
        return new Response("Payment provider disabled", { status: 410 });
      },
    },
  },
});
