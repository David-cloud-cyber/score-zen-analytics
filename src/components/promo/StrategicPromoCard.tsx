import { Link } from "@tanstack/react-router";
import { ArrowRight, ExternalLink, TicketCheck } from "lucide-react";
import { BOOKMAKERS } from "@/data/bookmakers";
import { track } from "@/lib/analytics";
import { AFF_REL, CopyCodeButton } from "./PromoUI";
import { BookmakerLogo } from "./BookmakerLogo";

type StrategicPromoCardProps = {
  location: "daily_predictions" | "prediction_history" | "match_list";
};

function partnerFor(location: StrategicPromoCardProps["location"]) {
  const index = {
    daily_predictions: 0,
    prediction_history: 1,
    match_list: 2,
  }[location];
  return BOOKMAKERS[index % BOOKMAKERS.length];
}

export function StrategicPromoCard({ location }: StrategicPromoCardProps) {
  const partner = partnerFor(location);
  if (!partner) return null;

  return (
    <aside
      aria-label={`Offre partenaire ${partner.name}`}
      className="overflow-hidden rounded-2xl border border-brand/20 bg-[linear-gradient(120deg,rgba(28,211,151,0.08),transparent_42%)]"
    >
      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 items-start gap-3">
          <BookmakerLogo
            name={partner.name}
            logoUrl={partner.logoUrl}
            accent={partner.accent}
            className="size-11 shrink-0"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-brand">
                <TicketCheck className="size-3.5" aria-hidden /> Offre partenaire
              </span>
              <span className="rounded-full bg-surface px-2 py-1 text-[9px] font-black uppercase tracking-wide text-muted-foreground">
                18+
              </span>
            </div>
            <p className="mt-1.5 text-base font-black leading-tight text-foreground">
              {partner.name} · {partner.bonusHeadline}
            </p>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              Saisissez le code pendant l’inscription et vérifiez les conditions de l’offre avant
              tout dépôt.
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-[auto_minmax(150px,1fr)_auto] lg:min-w-[490px]">
          <CopyCodeButton code={partner.code} size="sm" />
          <a
            href={partner.affiliateUrl}
            target="_blank"
            rel={AFF_REL}
            onClick={() =>
              track("promo_affiliate_click", {
                location: `${location}_${partner.slug}`,
              })
            }
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2 text-xs font-black text-brand-foreground transition-transform hover:scale-[1.01] active:scale-95"
          >
            S’inscrire avec {partner.code}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
          <Link
            to="/codes-promo/$slug"
            params={{ slug: partner.slug }}
            className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-black text-foreground hover:border-brand/40"
          >
            Conditions <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>
      <p className="border-t border-border/60 px-4 py-2 text-[9px] leading-relaxed text-muted-foreground sm:px-5">
        Offre soumise aux conditions de {partner.name} · Jouez de façon responsable.
      </p>
    </aside>
  );
}
