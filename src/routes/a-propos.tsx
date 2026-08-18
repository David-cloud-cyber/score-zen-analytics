import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { breadcrumbSchema, buildRouteMeta, ORG } from "@/lib/seo";

export const Route = createFileRoute("/a-propos")({
  head: () => ({
    ...buildRouteMeta({
      path: "/a-propos",
      title: "À propos de LiveFoot IA",
      description:
        "Découvrez LiveFoot IA, sa mission, ses sources football et sa méthode d’analyse transparente.",
    }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "À propos de LiveFoot IA",
          url: "https://www.livefoot.fun/a-propos",
          about: ORG,
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify(
          breadcrumbSchema([
            { name: "Accueil", path: "/" },
            { name: "À propos", path: "/a-propos" },
          ]),
        ),
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl space-y-7 px-4 pb-16 pt-8 lg:px-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-brand">LiveFoot IA</p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          Une lecture plus claire du football
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          LiveFoot rassemble scores, contexte de match, données vérifiées et analyses accessibles
          pour aider chacun à mieux comprendre une rencontre.
        </p>
        <section className="space-y-3">
          <h2 className="text-xl font-black">Notre méthode</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Nous séparons les informations confirmées des sections momentanément indisponibles. Les
            probabilités sont des estimations statistiques et ne constituent jamais une garantie de
            résultat ou de gain.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-black">Nos sources</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Les scores, événements et statistiques dépendent de fournisseurs sportifs et de leurs
            mises à jour. Les articles indiquent leurs sources et leur date de mise à jour lorsque
            cela est nécessaire.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-black">Nos engagements</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>Ne pas inventer de score, cote, blessure ou événement.</li>
            <li>Expliquer les limites d’une donnée ou d’une prédiction.</li>
            <li>Proposer un usage responsable des analyses et des contenus partenaires.</li>
          </ul>
        </section>
        <div className="flex flex-wrap gap-3 border-t border-border/70 pt-6">
          <a
            href="/blog"
            className="rounded-xl bg-brand px-4 py-3 text-sm font-black text-brand-foreground"
          >
            Lire la rédaction
          </a>
          <a
            href="/mentions-legales"
            className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-black"
          >
            Consulter les mentions légales
          </a>
        </div>
      </main>
    </AppShell>
  );
}
