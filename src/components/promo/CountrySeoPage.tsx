import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, MapPin, Sparkles } from "lucide-react";
import { AppShell, PageTitle } from "@/components/AppShell";
import {
  AffiliateButton,
  AnswerBox,
  Breadcrumb,
  CopyCodeButton,
  PromoFaq,
  ResponsibleGamblingNotice,
} from "@/components/promo/PromoUI";
import { BOOKMAKERS, type Bookmaker } from "@/data/bookmakers";
import {
  getCountryBookmakerPath,
  getCountryPath,
  type SeoCountry,
} from "@/data/country-seo";
import { track } from "@/lib/analytics";

const ANALYSE_CTA = "Analyser un match";

function CountryAnalyseCta({ location }: { location: string }) {
  return (
    <aside className="rounded-2xl border border-brand/30 bg-brand/5 p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <div className="space-y-2">
          <p className="text-sm font-black">Préparez votre prochain pari</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Consultez une analyse statistique claire avant de choisir votre rencontre. Les prédictions restent des
            estimations et ne garantissent aucun gain.
          </p>
          <Link
            to="/analyse"
            search={{ home: "", away: "" }}
            onClick={() => track("cta_click", { location })}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-black text-brand-foreground transition-transform hover:scale-[1.02] active:scale-95"
          >
            {ANALYSE_CTA}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </aside>
  );
}

function CountryFacts({ country }: { country: SeoCountry }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-border/70 bg-surface/40 p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Devise locale</p>
        <p className="mt-1 text-lg font-black">{country.currency}</p>
      </div>
      <div className="rounded-2xl border border-border/70 bg-surface/40 p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Paiements à vérifier</p>
        <p className="mt-1 text-sm font-bold">{country.paymentMethods.join(" · ")}</p>
      </div>
      <div className="rounded-2xl border border-border/70 bg-surface/40 p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Public concerné</p>
        <p className="mt-1 text-sm font-bold">Joueurs majeurs résidant au {country.name}</p>
      </div>
    </div>
  );
}

function CountryPartnerCard({ bookmaker, country }: { bookmaker: Bookmaker; country: SeoCountry }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-border/70 bg-surface/50">
      <div className="flex items-center gap-3 border-b border-border/60 p-4">
        <div
          className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl text-sm font-black text-white"
          style={{ backgroundColor: bookmaker.accent }}
        >
          <span aria-hidden>{bookmaker.name.slice(0, 2).toUpperCase()}</span>
          {bookmaker.logoUrl && (
            <img
              src={bookmaker.logoUrl}
              alt={`Logo ${bookmaker.name}`}
              loading="lazy"
              className="absolute inset-1 size-10 rounded-lg object-contain"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          )}
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-black">{bookmaker.name}</h2>
          <p className="truncate text-xs text-muted-foreground">Code partenaire : {bookmaker.code}</p>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <p className="text-lg font-black leading-tight">{bookmaker.bonusHeadline}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Conditions, dépôt minimum et montant final à confirmer selon le compte ouvert au {country.name}.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <CopyCodeButton code={bookmaker.code} size="sm" />
          <span className="text-[11px] text-muted-foreground">Dépôt min. indicatif : {bookmaker.minDeposit}</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <AffiliateButton href={bookmaker.affiliateUrl} className="flex-1">
            S’inscrire avec {bookmaker.code}
          </AffiliateButton>
          <a
            href={getCountryBookmakerPath(bookmaker.slug, country.slug)}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-border px-5 py-3 text-sm font-bold transition-colors hover:bg-surface"
          >
            Lire l’analyse <ArrowRight className="size-4" aria-hidden />
          </a>
        </div>
      </div>
    </article>
  );
}

export function CountryHubPage({ country }: { country: SeoCountry }) {
  const partners = BOOKMAKERS.filter((bookmaker) => bookmaker.countryPageSlugs?.includes(country.slug));

  return (
    <AppShell>
      <div className="space-y-8 px-4 pb-12 lg:px-0">
        <div className="pt-4">
          <Breadcrumb items={[{ label: "Accueil", to: "/" }, { label: "Codes promo", to: "/codes-promo" }, { label: country.name }]} />
        </div>

        <PageTitle eyebrow={`Offres en ${country.name}`} title={`Codes promo bookmakers au ${country.name}`} />

        <AnswerBox
          question={`Quel code promo bookmaker utiliser au ${country.name} ?`}
          answer={`LiveFoot recense les codes partenaires disponibles pour les joueurs majeurs au ${country.name}. Le code, le bonus, la devise ${country.currency} et les moyens de paiement doivent être vérifiés sur la page du bookmaker au moment de l’inscription.`}
        />

        <CountryAnalyseCta location={`country_${country.slug}_top`} />

        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            {country.intro} Cette page compare les offres de manière lisible : <strong className="text-foreground">code promo</strong>,
            bonus annoncé, dépôt minimum, conditions et lien d’inscription.
          </p>
          <p>
            Les moyens de paiement affichés sont des exemples courants pour la zone. La disponibilité, les plafonds et les
            conditions de retrait peuvent changer selon l’opérateur : vérifiez toujours l’écran de paiement avant de déposer.
          </p>
        </div>

        <CountryFacts country={country} />

        <section className="space-y-4" aria-label={`Codes promo au ${country.name}`}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-brand">Comparatif local</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight">Les offres à comparer</h2>
            </div>
            <MapPin className="size-6 text-brand" aria-hidden />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {partners.map((bookmaker) => (
              <CountryPartnerCard key={bookmaker.slug} bookmaker={bookmaker} country={country} />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-black tracking-tight">Comment choisir une offre au {country.name} ?</h2>
          <ul className="space-y-2">
            {[
              "Comparez le bonus réellement affiché avec le dépôt minimum et la cote minimale éventuelle.",
              "Saisissez le code pendant l’inscription, puis contrôlez qu’il est accepté avant le premier dépôt.",
              "Vérifiez la devise, les moyens de paiement, le délai de retrait et les conditions de mise.",
              "Utilisez uniquement une plateforme autorisée pour votre situation et ne misez jamais de l’argent nécessaire.",
            ].map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <CountryAnalyseCta location={`country_${country.slug}_bottom`} />

        <section className="space-y-3">
          <h2 className="text-xl font-black tracking-tight">Questions fréquentes</h2>
          <PromoFaq
            items={[
              {
                q: `Quel est le meilleur code promo bookmaker au ${country.name} ?`,
                a: `Il n’existe pas de meilleur code universel : comparez le montant du bonus, les conditions et les paiements réellement disponibles au ${country.name}. La fiche de chaque partenaire détaille les points à contrôler.`,
              },
              {
                q: `Les bonus sont-ils versés en ${country.currency} ?`,
                a: `La devise et la conversion dépendent du compte et de l’opérateur. Vérifiez la devise affichée avant le dépôt ainsi que les règles de retrait.`,
              },
              {
                q: "Quand faut-il saisir le code promo ?",
                a: "Pendant l’inscription, dans le champ dédié. Une fois le compte créé, l’application rétroactive du code est souvent impossible.",
              },
            ]}
          />
        </section>

        <ResponsibleGamblingNotice />
      </div>
    </AppShell>
  );
}

export function CountryBookmakerPage({ bookmaker, country }: { bookmaker: Bookmaker; country: SeoCountry }) {
  const answer = `Le code promo ${bookmaker.name} ${bookmaker.code} peut être utilisé par un joueur majeur au ${country.name} si l’offre est disponible pour son compte. Le montant du bonus, la devise ${country.currency}, le dépôt minimum et les moyens de paiement doivent être confirmés sur la page d’inscription.`;
  const faq = [
    {
      q: `Quel est le code promo ${bookmaker.name} au ${country.name} ?`,
      a: `Le code partenaire présenté pour ${bookmaker.name} est ${bookmaker.code}. Saisissez-le pendant l’inscription et vérifiez son acceptation avant de déposer.`,
    },
    {
      q: `Quel bonus ${bookmaker.name} peut-on obtenir au ${country.name} ?`,
      a: `La page affiche ${bookmaker.bonusHeadline.toLowerCase()}, mais le montant final et les conditions peuvent varier selon le pays, le compte et la campagne. Seule l’offre affichée par ${bookmaker.name} au moment de l’inscription fait foi.`,
    },
    {
      q: `Quels moyens de paiement sont proposés au ${country.name} ?`,
      a: `Les options courantes dans la zone incluent ${country.paymentMethods.join(", ")}. Leur disponibilité, les plafonds et les délais de retrait doivent être vérifiés directement dans le compte ${bookmaker.name}.`,
    },
  ];

  return (
    <AppShell>
      <article className="space-y-8 px-4 pb-12 lg:px-0">
        <div className="pt-4">
          <Breadcrumb
            items={[
              { label: "Accueil", to: "/" },
              { label: "Codes promo", to: "/codes-promo" },
              { label: country.name, to: getCountryPath(country.slug) },
              { label: bookmaker.name },
            ]}
          />
        </div>

        <header className="space-y-4 rounded-3xl border border-border/70 bg-surface/50 p-5">
          <div className="flex items-center gap-3">
            <div
              className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl text-base font-black text-white"
              style={{ backgroundColor: bookmaker.accent }}
            >
              <span aria-hidden>{bookmaker.name.slice(0, 2).toUpperCase()}</span>
              {bookmaker.logoUrl && (
                <img
                  src={bookmaker.logoUrl}
                  alt={`Logo ${bookmaker.name}`}
                  className="absolute inset-1 size-12 rounded-xl object-contain"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              )}
            </div>
            <div>
              <h1 className="text-[26px] font-black leading-tight tracking-tight lg:text-4xl">
                Code promo {bookmaker.name} {country.name} : {bookmaker.code}
              </h1>
              <span className="inline-flex items-center rounded-full bg-brand/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
                Offre partenaire à vérifier
              </span>
            </div>
          </div>
          <p className="text-lg font-black">{bookmaker.bonusHeadline}</p>
          <p className="text-sm text-muted-foreground">
            Analyse du code {bookmaker.code}, des conditions et du parcours d’inscription pour les joueurs au {country.name}.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <CopyCodeButton code={bookmaker.code} size="lg" />
            <AffiliateButton href={bookmaker.affiliateUrl}>S’inscrire avec {bookmaker.code}</AffiliateButton>
            <Link
              to="/analyse"
              search={{ home: "", away: "" }}
              onClick={() => track("cta_click", { location: `country_${bookmaker.slug}_${country.slug}_hero` })}
              className="inline-flex items-center gap-2 rounded-xl border border-brand/40 px-4 py-3 text-sm font-black text-brand transition-colors hover:bg-brand/10"
            >
              <Sparkles className="size-4" aria-hidden />
              {ANALYSE_CTA}
            </Link>
          </div>
          {bookmaker.bannerUrl && (
            <a href={bookmaker.bannerLinkUrl ?? bookmaker.affiliateUrl} target="_blank" rel="nofollow sponsored noopener" className="block overflow-hidden rounded-2xl">
              <img
                src={bookmaker.bannerUrl}
                alt={`Bonus ${bookmaker.name} avec le code ${bookmaker.code} au ${country.name}`}
                loading="lazy"
                className="w-full object-cover"
              />
            </a>
          )}
          <p className="text-[11px] text-muted-foreground">Contenu partenaire · 18+ · Offre et conditions à vérifier au moment de l’inscription</p>
        </header>

        <AnswerBox question={`Quel est le code promo ${bookmaker.name} au ${country.name} ?`} answer={answer} />
        <CountryAnalyseCta location={`country_${bookmaker.slug}_${country.slug}_answer`} />

        <CountryFacts country={country} />

        <section className="space-y-4">
          <h2 className="border-l-4 border-brand pl-3 text-xl font-black tracking-tight lg:text-2xl">
            Utiliser le code {bookmaker.code} au {country.name}
          </h2>
          <ol className="space-y-2">
            {[
              `Ouvrez la page d’inscription de ${bookmaker.name} depuis ce guide et choisissez le pays ${country.name}.`,
              `Saisissez ${bookmaker.code} dans le champ code promo avant de valider votre compte.`,
              `Contrôlez le bonus, la devise ${country.currency}, le dépôt minimum et les conditions de mise affichés.`,
              "Effectuez un dépôt uniquement après avoir vérifié les limites, les frais et le délai de retrait.",
            ].map((step, index) => (
              <li key={step} className="flex gap-3 rounded-xl border border-border/60 bg-surface/40 p-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-black text-brand-foreground">{index + 1}</span>
                <span className="text-sm leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="border-l-4 border-brand pl-3 text-xl font-black tracking-tight lg:text-2xl">Bonus, dépôt et conditions</h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            {bookmaker.bonusHeadline} est l’offre communiquée dans la fiche partenaire. Elle peut être ajustée selon la
            zone géographique, le profil du compte, la devise et la campagne active. Le dépôt minimum indicatif est de {bookmaker.minDeposit}.
          </p>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Avant toute mise, lisez les conditions de mise, la cote minimale éventuelle, la date d’expiration et les règles
            de retrait. La page d’inscription de {bookmaker.name} constitue la référence finale.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="border-l-4 border-brand pl-3 text-xl font-black tracking-tight lg:text-2xl">Paiements au {country.name}</h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Pour les joueurs au {country.name}, les solutions courantes peuvent inclure {country.paymentMethods.join(", ")}.
            Cette liste est informative : disponibilité, plafonds, frais et délais varient selon {bookmaker.name} et doivent être
            confirmés depuis l’espace de paiement.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="border-l-4 border-brand pl-3 text-xl font-black tracking-tight lg:text-2xl">Questions fréquentes</h2>
          <PromoFaq items={faq} />
        </section>

        <CountryAnalyseCta location={`country_${bookmaker.slug}_${country.slug}_bottom`} />
        <ResponsibleGamblingNotice />
        <div className="space-y-2 text-center text-sm">
          <p>
            <a href={`/codes-promo/${bookmaker.slug}`} className="font-bold text-brand hover:underline">
              Voir l’analyse générale du code promo {bookmaker.name}
            </a>
          </p>
          <p>
            <a href={getCountryPath(country.slug)} className="font-bold text-brand hover:underline">
              Voir tous les codes promo au {country.name}
            </a>
          </p>
        </div>
      </article>
    </AppShell>
  );
}
