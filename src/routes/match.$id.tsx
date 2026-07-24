import { createFileRoute, redirect } from "@tanstack/react-router";

// La fiche match complète (données réelles API-Football) vit désormais sur /live/$id.
// On redirige de façon permanente pour préserver les liens externes / sitemap historiques.
export const Route = createFileRoute("/match/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/live/$id", params: { id: params.id }, replace: true });
  },
  component: () => null,
});
