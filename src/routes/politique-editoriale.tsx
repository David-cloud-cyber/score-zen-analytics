import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { breadcrumbSchema, buildRouteMeta } from "@/lib/seo";

export const Route = createFileRoute("/politique-editoriale")({
  head: () => ({
    ...buildRouteMeta({
      path: "/politique-editoriale",
      title: "Politique éditoriale LiveFoot IA",
      description:
        "Sources, vérification, mises à jour et règles de publication des contenus football LiveFoot IA.",
    }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(
          breadcrumbSchema([
            { name: "Accueil", path: "/" },
            { name: "Politique éditoriale", path: "/politique-editoriale" },
          ]),
        ),
      },
    ],
  }),
  component: EditorialPolicyPage,
});

function EditorialPolicyPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl space-y-7 px-4 pb-16 pt-8 lg:px-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-brand">Transparence</p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Politique éditoriale</h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Chaque contenu LiveFoot doit apporter une information utile, lisible et vérifiable. La
          quantité de publications ne remplace jamais la qualité.
        </p>
        <section className="space-y-3">
          <h2 className="text-xl font-black">Vérification</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Les informations factuelles sont comparées à des sources officielles ou reconnues. Une
            information non confirmée est présentée comme telle ou retirée de la publication.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-black">Assistance par IA</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Des outils automatisés peuvent aider à rechercher, structurer ou relire un sujet. Une
            publication doit néanmoins passer les contrôles de sources, de fraîcheur, d’originalité
            et de cohérence.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-black">Mises à jour</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Les pages affichent une date de publication ou de mise à jour lorsqu’elle est
            pertinente. Modifier une date sans changement substantiel n’est pas considéré comme une
            mise à jour éditoriale.
          </p>
        </section>
        <a
          href="/blog"
          className="inline-flex rounded-xl bg-brand px-4 py-3 text-sm font-black text-brand-foreground"
        >
          Voir les articles
        </a>
      </main>
    </AppShell>
  );
}
