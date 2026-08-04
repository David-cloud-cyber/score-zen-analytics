import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Copy, ExternalLink, Star, ShieldAlert, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Bookmaker } from "@/data/bookmakers";

export const AFF_REL = "sponsored noopener noreferrer nofollow";

/** Bouton de copie du code promo. */
export function CopyCodeButton({ code, size = "md" }: { code: string; size?: "sm" | "md" | "lg" }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
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
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4 opacity-70" aria-hidden />}
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
            className={cn("size-3.5", i <= Math.round(rating) ? "fill-warn text-warn" : "text-border")}
            aria-hidden
          />
        ))}
      </div>
      <span className="text-xs font-bold tabular-nums">{rating.toFixed(1)}</span>
      {count !== undefined && <span className="text-[11px] text-muted-foreground">({count} avis)</span>}
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
    <article className="overflow-hidden rounded-2xl border border-border/70 bg-surface/50">
      <div className="flex items-start justify-between gap-3 border-b border-border/60 p-4">
        <div className="flex items-center gap-3">
          <div
            className="grid size-12 shrink-0 place-items-center rounded-xl text-sm font-black text-white"
            style={{ backgroundColor: b.accent }}
            aria-hidden
          >
            {b.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="text-base font-black leading-tight">{b.name}</h3>
            <RatingStars rating={b.rating} count={b.reviewCount} />
          </div>
        </div>
        <span className="rounded-full bg-warn/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-warn">
          Partenaire
        </span>
      </div>

      <div className="space-y-3 p-4">
        <p className="text-lg font-black leading-tight">{b.bonusHeadline}</p>
        <p className="text-xs text-muted-foreground">{b.tagline}</p>

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
    <div className="overflow-hidden rounded-2xl border border-border/70">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.label} className={cn(i % 2 === 1 && "bg-surface/50")}>
              <th scope="row" className="w-1/2 px-4 py-3 text-left align-top text-xs font-bold text-muted-foreground">
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
        <details key={item.q} className="group rounded-xl border border-border/70 bg-surface/40 px-4 py-3">
          <summary className="cursor-pointer list-none text-sm font-bold marker:hidden">
            <span className="flex items-center justify-between gap-3">
              {item.q}
              <ChevronRight className="size-4 shrink-0 transition-transform group-open:rotate-90" aria-hidden />
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
    <aside className="flex gap-3 rounded-2xl border border-alert/30 bg-alert/5 p-4">
      <ShieldAlert className="mt-0.5 size-5 shrink-0 text-alert" aria-hidden />
      <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
        <p className="font-bold text-foreground">Jeu responsable — interdit aux mineurs (18+)</p>
        <p>
          Les paris sportifs comportent des risques : endettement, isolement, dépendance. LiveFoot AI publie ces contenus
          à titre informatif et perçoit une commission d'affiliation sur les inscriptions. Nos analyses IA sont des
          estimations statistiques, jamais une garantie de gain. Ne jouez que l'argent que vous pouvez perdre.
        </p>
      </div>
    </aside>
  );
}

export function Breadcrumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
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
