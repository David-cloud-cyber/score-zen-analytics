import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { buildRouteMeta } from "@/lib/seo";

export const Route = createFileRoute("/mentions-legales")({
  head: () =>
    buildRouteMeta({
      path: "/mentions-legales",
      title: "Mentions légales & CGU",
      description: "Mentions légales, CGU, politique de confidentialité et avertissement paris sportifs de Livefoot IA.",
    }),
  component: LegalPage,
});

function LegalPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 lg:py-16">
      <Link to="/" className="mb-8 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Retour à l'accueil
      </Link>

      <h1 className="mb-2 text-3xl font-black tracking-tight lg:text-4xl">Mentions légales & CGU</h1>
      <p className="mb-8 text-sm text-muted-foreground">Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}</p>

      <div className="mb-8 flex gap-3 rounded-2xl bg-warn/10 p-4 ring-1 ring-warn/30">
        <AlertTriangle className="size-5 shrink-0 text-warn" />
        <div className="text-[13px] leading-relaxed">
          <strong className="font-black">Avertissement paris sportifs.</strong> Les analyses et
          probabilités présentées sur Livefoot IA sont fournies à titre <em>strictement
          informatif</em>. Elles ne constituent en aucun cas une incitation aux paris. Réservé aux
          personnes majeures (+18 ans). <strong>Jouer comporte des risques : endettement, isolement,
          dépendance.</strong> Pour être aidé, appelez le 09 74 75 13 13 (appel non surtaxé) ou
          rendez-vous sur{" "}
          <a href="https://www.joueurs-info-service.fr" target="_blank" rel="noreferrer" className="underline">
            joueurs-info-service.fr
          </a>.
        </div>
      </div>

      <Section title="Éditeur">
        <p>
          Livefoot IA est édité par <strong>[Raison sociale à compléter]</strong>, [forme juridique],
          au capital de [montant] €, immatriculée au RCS de [ville] sous le n° [SIREN], dont le siège
          social est situé [adresse complète]. Directeur de la publication : [Nom].
          Contact : <a href="mailto:contact@livefoot.fun" className="underline">contact@livefoot.fun</a>.
        </p>
      </Section>

      <Section title="Hébergement">
        <p>
          Le service est hébergé par Cloudflare (Cloudflare Pages) et Supabase.
          Infrastructure : Cloudflare Inc., 101 Townsend St, San Francisco, CA 94107, USA.
        </p>
      </Section>

      <Section title="Objet du service">
        <p>
          Livefoot IA est un service d'information sportive proposant scores en direct, statistiques
          et analyses générées par intelligence artificielle. Le service ne propose ni pari, ni jeu
          d'argent. Aucune transaction liée à des paris sportifs n'est traitée par Livefoot IA.
        </p>
      </Section>

      <Section title="Données personnelles (RGPD)">
        <p>
          Les données collectées (email, nom d'affichage, historique d'analyses, favoris) sont
          traitées par Livefoot IA en qualité de responsable de traitement, sur la base de votre
          consentement et de l'exécution du contrat. Elles sont conservées pendant la durée de votre
          compte + 3 ans. Vous disposez d'un droit d'accès, de rectification, d'effacement, de
          portabilité et d'opposition à l'adresse{" "}
          <a href="mailto:privacy@livefoot.fun" className="underline">privacy@livefoot.fun</a>. Vous
          pouvez introduire une réclamation auprès de la CNIL.
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          Le service utilise uniquement des cookies techniques nécessaires (session
          d'authentification, préférences d'interface). Aucun cookie publicitaire ni tracker tiers
          n'est déposé.
        </p>
      </Section>

      <Section title="Propriété intellectuelle">
        <p>
          Les marques et logos des clubs, compétitions et joueurs restent la propriété exclusive de
          leurs titulaires. Leur utilisation sur Livefoot IA relève d'un usage informatif et
          éditorial. Les contenus générés par IA sont fournis « en l'état », sans garantie de
          fiabilité ou d'exactitude.
        </p>
      </Section>

      <Section title="Responsabilité">
        <p>
          Livefoot IA ne saurait être tenu responsable des décisions prises sur la base des
          informations et analyses fournies. L'utilisateur reconnaît utiliser le service à ses
          risques et périls.
        </p>
      </Section>

      <Section title="Modification">
        <p>
          Les présentes CGU peuvent être modifiées à tout moment. Les utilisateurs seront informés de
          toute modification substantielle par email ou via l'interface.
        </p>
      </Section>

      <p className="mt-10 text-center text-[11px] text-muted-foreground">
        Modèle à compléter par vos coordonnées réelles avant mise en production commerciale.
        Consultation d'un avocat recommandée.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-lg font-black tracking-tight">{title}</h2>
      <div className="text-[14px] leading-relaxed text-foreground/80">{children}</div>
    </section>
  );
}
