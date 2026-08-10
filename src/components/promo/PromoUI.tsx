import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Copy, ExternalLink, Star, ShieldAlert, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Bookmaker } from "@/data/bookmakers";
import { track } from "@/lib/analytics";
import { BookmakerLogo } from "./BookmakerLogo";

export const AFF_REL = "sponsored noopener noreferrer nofollow";

/** Mise en valeur légère des termes qui répondent à l'intention de recherche. */
export function HighlightText({ text }: { text: string }) {
  const parts = text.split(
    /(code promo|BALL10|PREDAT|LIVEMONDE|bonus|dépôt|retrait|conditions|Mobile Money|18\+)/gi,
  );
  return (
    <>
      {parts.map((part, index) =>
        /^(code promo|BALL10|PREDAT|LIVEMONDE|bonus|dépôt|retrait|conditions|Mobile Money|18\+)$/i.test(
          part,
        ) ? (
          <strong key={`${part}-${index}`} className="font-bold text-foreground">
            {part}
          </strong>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </>
  );
}

/** Bouton de copie du code promo. */
export function CopyCodeButton({ code, size = "md" }: { code: string; size?: "sm" | "md" | "lg" }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      track("promo_code_copy", { location: code });
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copier le code promo ${code}`}
      className={cn(
        "group inline-flex items-center gap-2 rounded-xl border border-dashed border-brand/50 bg-brand/10 font-black uppercase tracking-[0.18em] text-brand transition-colors hover:bg-brand/20",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2.5 text-sm",
        size === "lg" && "px-5 py-3.5 text-lg",
      )}
    >
      <span>{code}</span>
      {copied ? (
        <Check className="size-4" aria-hidden />
      ) : (
        <Copy className="size-4 opacity-70" aria-hidden />
      )}
      <span className="sr-only">{copied ? "Code copié" : ""}</span>
    </button>
  );
}

export function RatingStars({ rating, count }: { rating: number; count?: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`Note ${rating} sur 5`}>
      <div className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(
              "size-3.5",
              i <= Math.round(rating) ? "fill-warn text-warn" : "text-border",
            )}
            aria-hidden
          />
        ))}
      </div>
      <span className="text-xs font-bold tabular-nums">{rating.toFixed(1)}</span>
      {count !== undefined && (
        <span className="text-[11px] text-muted-foreground">({count} avis)</span>
      )}
    </div>
  );
}

export function AffiliateButton({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel={AFF_REL}
      onClick={() => track("promo_affiliate_click", { location: href })}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-black text-brand-foreground transition-transform hover:scale-[1.02] active:scale-95",
        className,
      )}
    >
      {children}
      <ExternalLink className="size-4" aria-hidden />
    </a>
  );
}

/** Carte bookmaker affichée sur le hub. */
export function PromoCodeCard({ b }: { b: Bookmaker }) {
  return (
    <article className="animate-rise overflow-hidden rounded-xl border border-border/70 bg-surface/50">
      <div className="flex items-start justify-between gap-3 border-b border-border/60 p-4">
        <div className="flex items-center gap-3">
          <BookmakerLogo name={b.name} logoUrl={b.logoUrl} accent={b.accent} />
          <div>
            <h3 className="text-base font-black leading-tight">{b.name}</h3>
            {b.rating && b.reviewCount ? (
              <RatingStars rating={b.rating} count={b.reviewCount} />
            ) : (
              <span className="inline-flex items-center rounded-full bg-brand/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
                Bonus selon le pays
              </span>
            )}
          </div>
        </div>
        <span className="rounded-full bg-warn/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-warn">
          Partenaire
        </span>
      </div>

      <div className="space-y-3 p-4">
        <p className="text-lg font-black leading-tight">{b.bonusHeadline}</p>
        <p className="text-xs text-muted-foreground">{b.tagline}</p>
        <BonusTypeBadges types={b.bonusTypes} />

        <div className="flex flex-wrap items-center gap-2">
          <CopyCodeButton code={b.code} />
          <span className="text-[11px] text-muted-foreground">Dépôt min. {b.minDeposit}</span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <AffiliateButton href={b.affiliateUrl} className="flex-1">
            Récupérer le bonus
          </AffiliateButton>
          <Link
            to="/codes-promo/$slug"
            params={{ slug: b.slug }}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-border px-5 py-3 text-sm font-bold transition-colors hover:bg-surface"
          >
            Lire l'analyse <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}

export function BonusTable({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/70">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.label} className={cn(i % 2 === 1 && "bg-surface/50")}>
              <th
                scope="row"
                className="w-1/2 px-4 py-3 text-left align-top text-xs font-bold text-muted-foreground"
              >
                {r.label}
              </th>
              <td className="px-4 py-3 align-top font-semibold">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PromoFaq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <details
          key={item.q}
          className="group rounded-xl border border-border/70 bg-surface/40 px-4 py-3"
        >
          <summary className="cursor-pointer list-none text-sm font-bold marker:hidden">
            <span className="flex items-center justify-between gap-3">
              {item.q}
              <ChevronRight
                className="size-4 shrink-0 transition-transform group-open:rotate-90"
                aria-hidden
              />
            </span>
          </summary>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
        </details>
      ))}
    </div>
  );
}

export function ResponsibleGamblingNotice() {
  return (
    <aside className="flex gap-3 rounded-xl border border-alert/30 bg-alert/5 p-4">
      <ShieldAlert className="mt-0.5 size-5 shrink-0 text-alert" aria-hidden />
      <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
        <p className="font-bold text-foreground">Jeu responsable — interdit aux mineurs (18+)</p>
        <p>
          Les paris sportifs comportent des risques : endettement, isolement, dépendance. LiveFoot
          AI publie ces contenus à titre informatif et perçoit une commission d'affiliation sur les
          inscriptions. Nos analyses IA sont des estimations statistiques, jamais une garantie de
          gain. Ne jouez que l'argent que vous pouvez perdre.
        </p>
      </div>
    </aside>
  );
}

export function Breadcrumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav
      aria-label="Fil d'Ariane"
      className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground"
    >
      {items.map((it, i) => (
        <span key={it.label} className="flex items-center gap-1">
          {it.to ? (
            <Link to={it.to} className="hover:text-foreground">
              {it.label}
            </Link>
          ) : (
            <span className="font-semibold text-foreground">{it.label}</span>
          )}
          {i < items.length - 1 && <ChevronRight className="size-3" aria-hidden />}
        </span>
      ))}
    </nav>
  );
}

/** Tableau générique d'une section d'article. */
export function SectionTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/70">
      <table className="w-full min-w-[420px] text-sm">
        <thead className="bg-surface/70 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.join("|")} className="border-t border-border/60">
              {r.map((c, i) => (
                <td key={i} className={cn("px-4 py-3", i === 0 && "font-bold")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Maillage interne : alternatives / codes similaires en fin d'article. */
export function RelatedBookmakers({ items, title }: { items: Bookmaker[]; title?: string }) {
  if (items.length === 0) return null;
  return (
    <section aria-label="Codes promo similaires" className="space-y-3">
      <h2 className="border-l-4 border-brand pl-3 text-xl font-black tracking-tight lg:text-2xl">
        {title ?? "Meilleures alternatives : codes promo similaires"}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((b) => (
          <Link
            key={b.slug}
            to="/codes-promo/$slug"
            params={{ slug: b.slug }}
            className="flex items-center gap-3 rounded-2xl border border-border/70 bg-surface/40 p-4 transition-colors hover:bg-surface"
          >
            <BookmakerLogo
              name={b.name}
              logoUrl={b.logoUrl}
              accent={b.accent}
              className="size-11 text-xs"
              imageClassName="inset-0 size-full"
            />
            <span className="min-w-0">
              <span className="block text-sm font-black">
                Code promo {b.name} : {b.code}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {b.bonusHeadline}
              </span>
            </span>
            <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Étiquettes de types de bonus (filtres + cartes). */
export function BonusTypeBadges({ types }: { types: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {types.map((t) => (
        <span
          key={t}
          className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-muted-foreground"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

/**
 * Réponse directe (AEO/GEO) : 40-60 mots factuels placés juste après le H1.
 * Le `data-answer` est ciblé par le schéma `speakable` pour que les moteurs
 * de réponse et les IA génératives citent ce paragraphe.
 */
export function AnswerBox({ question, answer }: { question: string; answer: string }) {
  return (
    <section
      aria-label="Réponse rapide"
      className="rounded-2xl border-l-4 border-brand bg-brand/5 p-5"
    >
      <h2 className="mb-2 text-sm font-black uppercase tracking-widest text-brand">{question}</h2>
      <p data-answer className="text-[15px] font-medium leading-relaxed text-foreground">
        {answer}
      </p>
    </section>
  );
}
